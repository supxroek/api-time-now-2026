const db = require("../../config/db.config");

// Shift Model
class ShiftModel {
  // ==============================================================
  // สร้างกะการทำงานใหม่
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO shifts (${keys.join(", ")}) VALUES (${placeholders})`;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  // ==============================================================
  // ดึงข้อมูลกะการทำงานทั้งหมด พร้อม Pagination และ Filters
  async findAll(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `SELECT * FROM shifts WHERE company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm);
    }

    if (filters.type) {
      query += ` AND type = ?`;
      params.push(filters.type);
    }

    query += ` ORDER BY id ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวนกะการทำงานทั้งหมดที่ตรงกับ Filters
  async countAll(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM shifts WHERE company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm);
    }

    if (filters.type) {
      query += ` AND type = ?`;
      params.push(filters.type);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงข้อมูลกะการทำงานคนเดียวตาม ID
  async findById(id, companyId) {
    const query = `SELECT * FROM shifts WHERE id = ? AND company_id = ?`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงข้อมูลกะการทำงานตามชื่อ
  async findByName(name, companyId) {
    const query = `SELECT * FROM shifts WHERE name = ? AND company_id = ?`;
    const [rows] = await db.query(query, [name, companyId]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตข้อมูลกะการทำงาน
  async update(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `UPDATE shifts SET ${setClause} WHERE id = ? AND company_id = ?`;
    await db.query(query, [...values, id, companyId]);
  }

  // ==============================================================
  // ลบกะการทำงาน
  async delete(id, companyId) {
    const query = `DELETE FROM shifts WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new ShiftModel();
