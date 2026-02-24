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
    let query = `
      SELECT
        r.id,
        r.employee_id,
        r.shift_id,
        r.work_date,
        r.is_ot_allowed,
        r.is_public_holiday,
        r.leave_status,
        r.leave_hours_data,

        e.id AS employee_record_id,
        e.employee_code,
        e.name AS employee_name,
        e.image_url AS employee_avatar,
        e.department_id,
        e.status AS employee_status,

        s.id AS shift_record_id,
        s.name AS shift_name,
        s.type AS shift_type,
        s.start_time AS shift_start_time,
        s.end_time AS shift_end_time,
        s.is_break,
        s.break_start_time,
        s.break_end_time,
        s.is_night_shift
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
  async findEmployeeById(employeeId, companyId, executor = db) {
    const query = `SELECT * FROM employees WHERE id = ? AND company_id = ?`;
    const [rows] = await executor.query(query, [employeeId, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงข้อมูลกะการทำงานตาม ID (ใช้ตรวจสอบความเป็นเจ้าของ)
  async findShiftById(shiftId, companyId, executor = db) {
    const query = `SELECT * FROM shifts WHERE id = ? AND company_id = ?`;
    const [rows] = await executor.query(query, [shiftId, companyId]);
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

  // ==============================================================
  // ค้นหาตารางเวรของพนักงานตั้งแต่วันที่กำหนดเป็นต้นไป
  async findFutureByEmployee(companyId, employeeId, fromDate, executor = db) {
    const query = `
      SELECT
        r.*,
        COUNT(al.id) AS attendance_count
      FROM rosters r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN attendance_logs al ON al.roster_id = r.id
      WHERE e.company_id = ?
        AND r.employee_id = ?
        AND r.work_date >= ?
      GROUP BY r.id
      ORDER BY r.work_date ASC
    `;
    const [rows] = await executor.query(query, [
      companyId,
      employeeId,
      fromDate,
    ]);
    return rows;
  }

  // ==============================================================
  // ลบตารางเวรของพนักงานตั้งแต่วันที่กำหนดเป็นต้นไป
  async deleteFutureByEmployee(companyId, employeeId, fromDate, executor = db) {
    const query = `
      DELETE r
      FROM rosters r
      JOIN employees e ON r.employee_id = e.id
      WHERE e.company_id = ?
        AND r.employee_id = ?
        AND r.work_date >= ?
    `;
    const [result] = await executor.query(query, [
      companyId,
      employeeId,
      fromDate,
    ]);
    return result.affectedRows || 0;
  }

  // ==============================================================
  // ลบตารางเวรของพนักงานตามรายการ ID ที่ระบุ
  async deleteFutureByEmployeeIds(
    companyId,
    employeeId,
    rosterIds,
    executor = db,
  ) {
    if (!Array.isArray(rosterIds) || rosterIds.length === 0) return 0;

    const placeholders = rosterIds.map(() => "?").join(", ");
    const query = `
      DELETE r
      FROM rosters r
      JOIN employees e ON r.employee_id = e.id
      WHERE e.company_id = ?
        AND r.employee_id = ?
        AND r.id IN (${placeholders})
    `;

    const [result] = await executor.query(query, [
      companyId,
      employeeId,
      ...rosterIds,
    ]);
    return result.affectedRows || 0;
  }
}

module.exports = new RosterModel();
