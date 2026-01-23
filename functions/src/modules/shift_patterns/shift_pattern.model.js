const db = require("../../config/db.config");

// Shift Pattern Model
class ShiftPatternModel {
  // ==============================================================
  // สร้างรูปแบบกะการทำงาน
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO shift_patterns (${keys.join(", ")}) VALUES (${placeholders})`;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  // ==============================================================
  // ดึงข้อมูลรูปแบบกะการทำงานทั้งหมด พร้อม Pagination และ Filters
  async findAll(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `SELECT * FROM shift_patterns WHERE company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm);
    }

    query += ` ORDER BY id ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวนรูปแบบกะการทำงานทั้งหมดที่ตรงกับ Filters
  async countAll(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM shift_patterns WHERE company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงข้อมูลรูปแบบกะการทำงานคนเดียวตาม ID
  async findById(id, companyId) {
    const query = `SELECT * FROM shift_patterns WHERE id = ? AND company_id = ?`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตข้อมูลรูปแบบกะการทำงาน
  async update(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `UPDATE shift_patterns SET ${setClause} WHERE id = ? AND company_id = ?`;
    await db.query(query, [...values, id, companyId]);
  }

  // ==============================================================
  // ลบรูปแบบกะการทำงาน
  async delete(id, companyId) {
    const query = `DELETE FROM shift_patterns WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new ShiftPatternModel();
