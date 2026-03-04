const db = require("../../../config/db.config");

class ShiftModel {
  async create(data) {
    const keys = Object.keys(data);
    const values = keys.map((key) => data[key]);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `
      INSERT INTO shifts (${keys.join(", ")})
      VALUES (${placeholders})
    `;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  async findAllByCompanyId(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `
      SELECT
        id,
        company_id,
        name,
        type,
        start_time,
        end_time,
        is_break,
        break_start_time,
        break_end_time,
        is_night_shift,
        deleted_at
      FROM shifts
      WHERE company_id = ?
        AND deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.search) {
      query += " AND name LIKE ?";
      params.push(`%${filters.search}%`);
    }

    if (filters.type) {
      query += " AND type = ?";
      params.push(filters.type);
    }

    query += " ORDER BY id ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findOverviewByCompanyId(companyId) {
    const query = `
      SELECT
        id,
        company_id,
        name,
        type,
        start_time,
        end_time,
        is_break,
        break_start_time,
        break_end_time,
        is_night_shift,
        deleted_at
      FROM shifts
      WHERE company_id = ?
        AND deleted_at IS NULL
      ORDER BY id ASC
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows;
  }

  async countOverviewByCompanyId(companyId) {
    const query = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN type = 'fixed' THEN 1 ELSE 0 END) AS fixed_count,
        SUM(CASE WHEN type = 'flexible' THEN 1 ELSE 0 END) AS flexible_count,
        SUM(CASE WHEN is_night_shift = 1 THEN 1 ELSE 0 END) AS night_shift_count,
        SUM(CASE WHEN is_break = 1 THEN 1 ELSE 0 END) AS with_break_count
      FROM shifts
      WHERE company_id = ?
        AND deleted_at IS NULL
    `;

    const [rows] = await db.query(query, [companyId]);
    return (
      rows[0] || {
        total: 0,
        fixed_count: 0,
        flexible_count: 0,
        night_shift_count: 0,
        with_break_count: 0,
      }
    );
  }

  async countAllByCompanyId(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) AS total
      FROM shifts
      WHERE company_id = ?
        AND deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.search) {
      query += " AND name LIKE ?";
      params.push(`%${filters.search}%`);
    }

    if (filters.type) {
      query += " AND type = ?";
      params.push(filters.type);
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
        type,
        start_time,
        end_time,
        is_break,
        break_start_time,
        break_end_time,
        is_night_shift,
        deleted_at
      FROM shifts
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
        type,
        start_time,
        end_time,
        is_break,
        break_start_time,
        break_end_time,
        is_night_shift,
        deleted_at
      FROM shifts
      WHERE id = ? AND company_id = ? AND deleted_at IS NOT NULL
      LIMIT 1
    `;

    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async findByNameAndCompanyId(name, companyId, excludeId = null) {
    let query = `
      SELECT id, company_id, name
      FROM shifts
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
      UPDATE shifts
      SET ${setClause}
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [...values, id, companyId]);
  }

  async softDeleteByIdAndCompanyId(id, companyId) {
    const query = `
      UPDATE shifts
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
    `;
    await db.query(query, [id, companyId]);
  }

  async restoreByIdAndCompanyId(id, companyId) {
    const query = `
      UPDATE shifts
      SET deleted_at = NULL
      WHERE id = ? AND company_id = ? AND deleted_at IS NOT NULL
    `;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new ShiftModel();
