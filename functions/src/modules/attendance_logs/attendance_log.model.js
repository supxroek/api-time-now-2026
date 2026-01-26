const db = require("../../config/db.config");

// Attendance Log Model
class AttendanceLogModel {
  // ==============================================================
  // ค้นหาบันทึกการเข้าออกงานทั้งหมด
  async findAll(companyId, filters = {}, limit = 50, offset = 0) {
    let query = `
      SELECT al.*, e.*, e.name as employee_name
      FROM attendance_logs al
      JOIN employees e ON al.employee_id = e.id
      WHERE e.company_id = ?
    `;
    const params = [companyId];

    // การกรองข้อมูล
    // หากมีการระบุ employee_id
    if (filters.employee_id) {
      query += ` AND al.employee_id = ?`;
      params.push(filters.employee_id);
    }
    // หากมีการระบุช่วงวันที่เริ่มต้น
    if (filters.start_date) {
      query += ` AND DATE(al.log_timestamp) >= ?`;
      params.push(filters.start_date);
    }
    // หากมีการระบุช่วงวันที่สิ้นสุด
    if (filters.end_date) {
      query += ` AND DATE(al.log_timestamp) <= ?`;
      params.push(filters.end_date);
    }
    // หากมีการระบุประเภทบันทึก
    if (filters.log_type) {
      query += ` AND al.log_type = ?`;
      params.push(filters.log_type);
    }

    query += ` ORDER BY al.log_timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // ดึงจำนวนบันทึกการเข้าออกงานทั้งหมด
  async countAll(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) as total
      FROM attendance_logs al
      JOIN employees e ON al.employee_id = e.id
      WHERE e.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += ` AND al.employee_id = ?`;
      params.push(filters.employee_id);
    }

    if (filters.start_date) {
      query += ` AND DATE(al.log_timestamp) >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND DATE(al.log_timestamp) <= ?`;
      params.push(filters.end_date);
    }

    if (filters.log_type) {
      query += ` AND al.log_type = ?`;
      params.push(filters.log_type);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }
}

module.exports = new AttendanceLogModel();
