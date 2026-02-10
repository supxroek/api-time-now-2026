const db = require("../../config/db.config");

// OT Template Model
class OtTemplateModel {
  // ==============================================================
  // สร้างแม่แบบการทำงานล่วงเวลาใหม่
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO ot_templates (${keys.join(", ")}) VALUES (${placeholders})`;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  // ==============================================================
  // ดึงแม่แบบการทำงานล่วงเวลาทั้งหมด
  async findAll(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `SELECT * FROM ot_templates WHERE company_id = ? AND deleted_at IS NULL`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวนแม่แบบการทำงานล่วงเวลาทั้งหมด
  async countAll(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM ot_templates WHERE company_id = ? AND deleted_at IS NULL`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // นับจำนวนการใช้งานแม่แบบการทำงานล่วงเวลา
  async countUsage(companyId) {
    const query = `
      SELECT ot.id, ot.name, COUNT(r.id) AS count
      FROM ot_templates ot
      LEFT JOIN requests r ON r.request_type = 'ot'
      AND JSON_EXTRACT(r.request_data, '$.ot_template_id') = ot.id
      AND r.company_id = ?
      WHERE ot.company_id = ? AND ot.deleted_at IS NULL
      GROUP BY ot.id, ot.name
      ORDER BY count DESC;
    `;
    const [rows] = await db.query(query, [companyId, companyId]);

    return rows[0];
  }

  // ==============================================================
  // ดึงแม่แบบการทำงานล่วงเวลาโดย ID
  async findById(id, companyId) {
    const query = `SELECT * FROM ot_templates WHERE id = ? AND company_id = ? AND deleted_at IS NULL`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงแม่แบบการทำงานล่วงเวลาตามชื่อ
  async findByName(name, companyId) {
    const query = `SELECT * FROM ot_templates WHERE name = ? AND company_id = ? AND deleted_at IS NULL`;
    const [rows] = await db.query(query, [name, companyId]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตแม่แบบการทำงานล่วงเวลา
  async update(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `UPDATE ot_templates SET ${setClause} WHERE id = ? AND company_id = ?`;
    await db.query(query, [...values, id, companyId]);
  }

  // ==============================================================
  // ลบแม่แบบการทำงานล่วงเวลา (Soft Delete)
  async softDelete(id, companyId) {
    const query = `UPDATE ot_templates SET deleted_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ? AND company_id = ? AND deleted_at IS NULL`;
    await db.query(query, [id, companyId]);
  }

  // ==============================================================
  // ลบแม่แบบการทำงานล่วงเวลา
  async delete(id, companyId) {
    const query = `DELETE FROM ot_templates WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }

  // ==============================================================
  // ดึงแม่แบบการทำงานล่วงเวลาที่ถูกลบแบบ Soft Delete
  async findAllDeleted(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `SELECT * FROM ot_templates WHERE company_id = ? AND deleted_at IS NOT NULL`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    query += ` ORDER BY deleted_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // ดึงแม่แบบการทำงานล่วงเวลาที่ถูกลบแบบ Soft Delete โดย ID
  async findDeletedById(id, companyId) {
    const query = `SELECT * FROM ot_templates WHERE id = ? AND company_id = ? AND deleted_at IS NOT NULL`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // นับจำนวนแม่แบบการทำงานล่วงเวลาที่ถูกลบแบบ Soft Delete
  async countAllDeleted(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM ot_templates WHERE company_id = ? AND deleted_at IS NOT NULL`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // กู้คืนแม่แบบการทำงานล่วงเวลาที่ถูกลบแบบ Soft Delete
  async restore(id, companyId) {
    const query = `UPDATE ot_templates SET deleted_at = NULL, is_active = 1 WHERE id = ? AND company_id = ? AND deleted_at IS NOT NULL`;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new OtTemplateModel();
