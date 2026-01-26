const db = require("../../config/db.config");

// Branch Model
class BranchModel {
  // ==============================================================
  // สร้างสาขาใหม่
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO branches (${keys.join(", ")}) VALUES (${placeholders})`;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  // ==============================================================
  // ดึงข้อมูลสาขาทั้งหมด พร้อม Pagination และ Filters
  async findAll(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `SELECT * FROM branches WHERE company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND branch_name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวนสาขาทั้งหมดที่ตรงกับ Filters
  async countAll(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM branches WHERE company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND branch_name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงข้อมูลสาขาคนเดียวตาม ID
  async findById(id, companyId) {
    const query = `SELECT * FROM branches WHERE id = ? AND company_id = ?`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงข้อมูลสาขาคนเดียวตามชื่อ
  async findByName(branchName, companyId) {
    const query = `SELECT * FROM branches WHERE branch_name = ? AND company_id = ?`;
    const [rows] = await db.query(query, [branchName, companyId]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตข้อมูลสาขา
  async update(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `UPDATE branches SET ${setClause} WHERE id = ? AND company_id = ?`;
    await db.query(query, [...values, id, companyId]);
  }

  // ==============================================================
  // ลบสาขา (hard delete)
  async delete(id, companyId) {
    const query = `DELETE FROM branches WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new BranchModel();
