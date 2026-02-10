const db = require("../../config/db.config");

// Department Model
class DepartmentModel {
  // ==============================================================
  // สร้างแผนกใหม่
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO departments (${keys.join(", ")}) VALUES (${placeholders})`;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  // ==============================================================
  // ดึงข้อมูลแผนกทั้งหมด พร้อม Pagination และ Filters
  async findAll(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `
      SELECT d.*,
             (SELECT COUNT(*) 
              FROM employees e 
              WHERE e.department_id = d.id 
                AND e.status = 'active' 
                AND e.deleted_at IS NULL) AS employee_count 
      FROM departments d 
      WHERE d.company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND d.department_name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    if (filters.branch_id) {
      query += ` AND d.branch_id = ?`;
      params.push(filters.branch_id);
    }

    query += ` ORDER BY d.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวนแผนกทั้งหมดที่ตรงกับ Filters
  async countAll(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM departments WHERE company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND department_name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    if (filters.branch_id) {
      query += ` AND branch_id = ?`;
      params.push(filters.branch_id);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงข้อมูลแผนกคนเดียวตาม ID
  async findById(id, companyId) {
    const query = `SELECT * FROM departments WHERE id = ? AND company_id = ?`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงข้อมูลแผนกคนเดียวตามชื่อ
  async findByName(departmentName, companyId) {
    const query = `SELECT * FROM departments WHERE department_name = ? AND company_id = ?`;
    const [rows] = await db.query(query, [departmentName, companyId]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตข้อมูลแผนก
  async update(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `UPDATE departments SET ${setClause} WHERE id = ? AND company_id = ?`;
    await db.query(query, [...values, id, companyId]);
  }

  // ==============================================================
  // ลบแผนก
  async delete(id, companyId) {
    // ทำการลบจริง (hard delete)
    const query = `DELETE FROM departments WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new DepartmentModel();
