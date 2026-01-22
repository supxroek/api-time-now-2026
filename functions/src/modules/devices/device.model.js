const db = require("../../config/db.config");

// Device Model
class DeviceModel {
  // ==============================================================
  // สร้างอุปกรณ์ใหม่
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO devices (${keys.join(", ")}) VALUES (${placeholders})`;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  // ==============================================================
  // ดึงข้อมูลอุปกรณ์ทั้งหมด พร้อม Pagination และ Filters
  async findAll(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `SELECT * FROM devices WHERE company_id = ?`; // No deleted_at in devices schema provided
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ? OR hwid LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.branch_id) {
      query += ` AND branch_id = ?`;
      params.push(filters.branch_id);
    }

    if (filters.hasOwnProperty("is_active")) {
      query += ` AND is_active = ?`;
      params.push(filters.is_active);
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวนอุปกรณ์ทั้งหมดที่ตรงกับ Filters
  async countAll(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM devices WHERE company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ? OR hwid LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.branch_id) {
      query += ` AND branch_id = ?`;
      params.push(filters.branch_id);
    }

    if (filters.hasOwnProperty("is_active")) {
      query += ` AND is_active = ?`;
      params.push(filters.is_active);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงข้อมูลอุปกรณ์คนเดียวตาม ID
  async findById(id, companyId) {
    const query = `SELECT * FROM devices WHERE id = ? AND company_id = ?`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงข้อมูลอุปกรณ์ตาม HWID
  async findByHwid(hwid) {
    const query = `SELECT * FROM devices WHERE hwid = ?`;
    const [rows] = await db.query(query, [hwid]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตข้อมูลอุปกรณ์
  async update(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `UPDATE devices SET ${setClause} WHERE id = ? AND company_id = ?`;
    await db.query(query, [...values, id, companyId]);
  }

  // ==============================================================
  // ลบอุปกรณ์
  async delete(id, companyId) {
    const query = `DELETE FROM devices WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new DeviceModel();
