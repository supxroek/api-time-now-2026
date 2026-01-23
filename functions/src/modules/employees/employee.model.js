const db = require("../../config/db.config");

// Employee Model
class EmployeeModel {
  // ==============================================================
  // สร้างพนักงานใหม่
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO employees (${keys.join(", ")}) VALUES (${placeholders})`;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  // ==============================================================
  // ดึงข้อมูลพนักงานทั้งหมด พร้อม Pagination และ Filters
  async findAll(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `SELECT * FROM employees WHERE company_id = ? AND deleted_at IS NULL`;
    const params = [companyId];

    // เพิ่มเงื่อนไข Filters
    // ค้นหาด้วยชื่อ, รหัสพนักงาน, อีเมล
    if (filters.search) {
      query += ` AND (name LIKE ? OR employee_code LIKE ? OR email LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // กรองตามสถานะ
    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    // กรองตามแผนก
    if (filters.department_id) {
      query += ` AND department_id = ?`;
      params.push(filters.department_id);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวนพนักงานทั้งหมดที่ตรงกับ Filters
  async countAll(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM employees WHERE company_id = ? AND deleted_at IS NULL`;
    const params = [companyId];

    // เพิ่มเงื่อนไข Filters
    // ค้นหาด้วยชื่อ, รหัสพนักงาน, อีเมล
    if (filters.search) {
      query += ` AND (name LIKE ? OR employee_code LIKE ? OR email LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // กรองตามสถานะ
    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    // กรองตามแผนก
    if (filters.department_id) {
      query += ` AND department_id = ?`;
      params.push(filters.department_id);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงข้อมูลพนักงานคนเดียวตาม ID
  async findById(id, companyId) {
    const query = `SELECT * FROM employees WHERE id = ? AND company_id = ? AND deleted_at IS NULL`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงข้อมูลพนักงานตามฟิลด์ที่เป็นเอกลักษณ์ (เช่น email หรือ employee_code)
  async findByUniqueFields(companyId, uniqueData) {
    const fields = Object.keys(uniqueData).filter(
      (key) =>
        uniqueData[key] !== null &&
        uniqueData[key] !== undefined &&
        uniqueData[key] !== "",
    );

    if (fields.length === 0) return null;

    const conditions = fields.map((field) => `${field} = ?`).join(" OR ");
    const values = fields.map((field) => uniqueData[field]);

    // Query นี้จะหาว่ามีใครที่ใช้ข้อมูลใดข้อมูลหนึ่งซ้ำ ภายใต้บริษัทเดียวกัน
    const query = `
        SELECT email, id_or_passport_number, line_user_id 
        FROM employees 
        WHERE (${conditions}) 
        AND company_id = ? 
        AND deleted_at IS NULL 
        LIMIT 1
    `;

    const [rows] = await db.query(query, [...values, companyId]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตข้อมูลพนักงาน
  async update(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `UPDATE employees SET ${setClause} WHERE id = ? AND company_id = ?`;
    await db.query(query, [...values, id, companyId]);
  }

  // ==============================================================
  // ลบพนักงาน (soft delete)
  async softDelete(id, companyId) {
    const query = `UPDATE employees SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new EmployeeModel();
