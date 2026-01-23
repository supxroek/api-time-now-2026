const db = require("../../config/db.config");

// Roster Model
class RosterModel {
  // ==============================================================
  // สร้างตารางเวร (Roster)
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO rosters (${keys.join(", ")}) VALUES (${placeholders})`;

    const [result] = await db.query(query, values);
    return result.insertId; // Returns BigInt or Number depending on driver config
  }

  // ==============================================================
  // สร้างตารางเวรแบบหลายรายการ (Bulk Insert) - Optional but good for performance
  async createBulk(fields, values) {
    if (values.length === 0) return;
    const placeholders = values
      .map(() => `(${fields.map(() => "?").join(", ")})`)
      .join(", ");
    // values is array of arrays
    // Construct query carefully manually or use pool.query format
    const query = `INSERT INTO rosters (${fields.join(", ")}) VALUES ${placeholders}`;
    const [result] = await db.query(query, values.flat());
    return result;
  }

  // ==============================================================
  // ดึงข้อมูลตารางเวรทั้งหมด พร้อม Pagination และ Filters
  async findAll(companyId, filters = {}, limit = 50, offset = 0) {
    // Need to join with employees to filter by company_id correctly
    let query = `
      SELECT r.*, e.*, e.name as employee_name, s.*, s.name as shift_name
      FROM rosters r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN shifts s ON r.shift_id = s.id
      WHERE e.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += ` AND r.employee_id = ?`;
      params.push(filters.employee_id);
    }

    if (filters.start_date && filters.end_date) {
      query += ` AND r.work_date BETWEEN ? AND ?`;
      params.push(filters.start_date, filters.end_date);
    } else if (filters.work_date) {
      query += ` AND r.work_date = ?`;
      params.push(filters.work_date);
    }

    query += ` ORDER BY r.work_date DESC, e.name ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวนตารางเวรทั้งหมดที่ตรงกับ Filters
  async countAll(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) as total
      FROM rosters r
      JOIN employees e ON r.employee_id = e.id
      WHERE e.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += ` AND r.employee_id = ?`;
      params.push(filters.employee_id);
    }

    if (filters.start_date && filters.end_date) {
      query += ` AND r.work_date BETWEEN ? AND ?`;
      params.push(filters.start_date, filters.end_date);
    } else if (filters.work_date) {
      query += ` AND r.work_date = ?`;
      params.push(filters.work_date);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงข้อมูลตารางเวรตาม ID
  async findById(id, companyId) {
    const query = `
      SELECT r.*
      FROM rosters r
      JOIN employees e ON r.employee_id = e.id
      WHERE r.id = ? AND e.company_id = ?
    `;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงข้อมูลตารางเวรตาม Employee และ Date (ตรวจสอบซ้ำ)
  async findByEmployeeAndDate(employeeId, date) {
    const query = `SELECT * FROM rosters WHERE employee_id = ? AND work_date = ?`;
    const [rows] = await db.query(query, [employeeId, date]);
    return rows[0];
  }

  // ==============================================================
  // ดึงข้อมูลพนักงานตาม ID (ใช้ตรวจสอบความเป็นเจ้าของ)
  async findEmployeeById(employeeId, companyId) {
    const query = `SELECT * FROM employees WHERE id = ? AND company_id = ?`;
    const [rows] = await db.query(query, [employeeId, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงข้อมูลกะการทำงานตาม ID (ใช้ตรวจสอบความเป็นเจ้าของ)
  async findShiftById(shiftId, companyId) {
    const query = `SELECT * FROM shifts WHERE id = ? AND company_id = ?`;
    const [rows] = await db.query(query, [shiftId, companyId]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตข้อมูลตารางเวร
  async update(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    // Check ownership via join update or select first?
    // Safe way: Update with join or check existence first.
    // Using check existence in Service is better. Here just simple update by ID.
    // However, to ensure company_id integrity in raw SQL update:
    // UPDATE rosters r JOIN employees e ON r.employee_id = e.id SET ... WHERE r.id = ? AND e.company_id = ?

    const setClause = keys.map((key) => `r.${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `
      UPDATE rosters r
      JOIN employees e ON r.employee_id = e.id
      SET ${setClause}
      WHERE r.id = ? AND e.company_id = ?
    `;
    await db.query(query, [...values, id, companyId]);
  }

  // ==============================================================
  // ลบตารางเวร
  async delete(id, companyId) {
    const query = `
      DELETE r FROM rosters r
      JOIN employees e ON r.employee_id = e.id
      WHERE r.id = ? AND e.company_id = ?
    `;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new RosterModel();
