const db = require("../../../config/db.config");

class OtTemplateModel {
  async create(data) {
    const keys = Object.keys(data);
    const values = keys.map((key) => data[key]);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `
      INSERT INTO ot_templates (${keys.join(", ")})
      VALUES (${placeholders})
    `;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  async findAllByCompanyId(companyId, search = "", limit = 20, offset = 0) {
    let query = `
      SELECT
        id,
        company_id,
        name,
        start_time,
        end_time,
        duration_hours,
        overtime_rate,
        is_active,
        deleted_at
      FROM ot_templates
      WHERE company_id = ?
        AND deleted_at IS NULL
    `;
    const params = [companyId];

    if (search) {
      query += " AND name LIKE ?";
      params.push(`%${search}%`);
    }

    query += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async countAllByCompanyId(companyId, search = "") {
    let query = `
      SELECT COUNT(*) AS total
      FROM ot_templates
      WHERE company_id = ?
        AND deleted_at IS NULL
    `;
    const params = [companyId];

    if (search) {
      query += " AND name LIKE ?";
      params.push(`%${search}%`);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  async findByIdAndCompanyId(id, companyId) {
    const query = `
      SELECT
        id,
        company_id,
        name,
        start_time,
        end_time,
        duration_hours,
        overtime_rate,
        is_active,
        deleted_at
      FROM ot_templates
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;

    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async findDeletedByIdAndCompanyId(id, companyId) {
    const query = `
      SELECT
        id,
        company_id,
        name,
        start_time,
        end_time,
        duration_hours,
        overtime_rate,
        is_active,
        deleted_at
      FROM ot_templates
      WHERE id = ? AND company_id = ? AND deleted_at IS NOT NULL
      LIMIT 1
    `;

    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async findByNameAndCompanyId(name, companyId, excludeId = null) {
    let query = `
      SELECT id, company_id, name
      FROM ot_templates
      WHERE name = ? AND company_id = ? AND deleted_at IS NULL
    `;
    const params = [name, companyId];

    if (excludeId) {
      query += " AND id <> ?";
      params.push(excludeId);
    }

    query += " LIMIT 1";

    const [rows] = await db.query(query, params);
    return rows[0] || null;
  }

  async updateByIdAndCompanyId(id, companyId, data) {
    const keys = Object.keys(data);
    if (!keys.length) {
      return;
    }

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => data[key]);

    const query = `
      UPDATE ot_templates
      SET ${setClause}
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [...values, id, companyId]);
  }

  async softDeleteByIdAndCompanyId(id, companyId) {
    const query = `
      UPDATE ot_templates
      SET deleted_at = CURRENT_TIMESTAMP, is_active = 0
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
    `;
    await db.query(query, [id, companyId]);
  }

  async restoreByIdAndCompanyId(id, companyId) {
    const query = `
      UPDATE ot_templates
      SET deleted_at = NULL, is_active = 1
      WHERE id = ? AND company_id = ? AND deleted_at IS NOT NULL
    `;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new OtTemplateModel();
