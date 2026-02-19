const db = require("../../config/db.config");

// Dashboard Model
class DashboardModel {
  // ==============================================================
  // ดึงบันทึกเวลาวันนี้ (เฉพาะวันปัจจุบัน) พร้อมข้อมูลพนักงาน
  async getTodayAttendanceLogs(companyId, limit = 20) {
    const query = `
      SELECT al.id, al.employee_id, al.log_type, al.log_timestamp, al.status,
             e.employee_code, e.name AS employee_name, e.image_url AS employee_avatar,
             d.name AS device_name, d.location_name
      FROM attendance_logs al
      JOIN employees e ON al.employee_id = e.id
      LEFT JOIN devices d ON al.device_id = d.id
      WHERE e.company_id = ?
        AND DATE(al.log_timestamp) = CURDATE()
      ORDER BY al.log_timestamp DESC
      LIMIT ?
    `;
    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

  // ==============================================================
  // ดึงสถิติภาพรวมการเข้างานวันนี้
  async getTodayStats(companyId) {
    const query = `
      SELECT
        (SELECT COUNT(*) 
           FROM employees e 
           WHERE e.company_id = c.company_id
             AND e.deleted_at IS NULL) AS total_employees,

        (SELECT COUNT(DISTINCT al.employee_id)
           FROM attendance_logs al
           JOIN employees e2 ON al.employee_id = e2.id
           WHERE e2.company_id = c.company_id
             AND DATE(al.log_timestamp) = CURDATE()
             AND al.status IS NOT NULL AND al.status != 'null') AS came_to_work,

        (SELECT COUNT(DISTINCT al.employee_id)
           FROM attendance_logs al
           JOIN employees e3 ON al.employee_id = e3.id
           WHERE e3.company_id = c.company_id
             AND DATE(al.log_timestamp) = CURDATE()
             AND al.status = 'late') AS late,

        (SELECT COUNT(*)
           FROM rosters r
           JOIN employees e4 ON r.employee_id = e4.id
           LEFT JOIN attendance_logs al2 ON al2.employee_id = r.employee_id
             AND DATE(al2.log_timestamp) = CURDATE()
           WHERE e4.company_id = c.company_id
             AND r.work_date = CURDATE()
             AND al2.id IS NULL) AS not_came_to_work
      FROM (SELECT ? AS company_id) c
    `;
    const [rows] = await db.query(query, [companyId]);
    const stats = rows[0];
    stats.absent = stats.total_employees - stats.came_to_work;
    return stats;
  }

  // ==============================================================
  // ดึงจำนวนคำขอที่รออนุมัติ
  async getPendingRequestCount(companyId) {
    const query = `
      SELECT COUNT(*) AS total
      FROM requests r
      JOIN employees e ON r.employee_id = e.id
      WHERE e.company_id = ?
        AND r.status = 'pending'
    `;
    const [rows] = await db.query(query, [companyId]);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงคำขอที่รออนุมัติล่าสุด (พร้อมข้อมูลพนักงาน)
  async getPendingRequests(companyId, limit = 20) {
    const query = `
      SELECT r.id, r.request_type, r.status, r.request_data, r.created_at,
             e.id AS employee_id, e.name AS employee_name, e.employee_code, e.image_url AS employee_avatar
      FROM requests r
      JOIN employees e ON r.employee_id = e.id
      WHERE e.company_id = ?
        AND r.status = 'pending'
      ORDER BY r.created_at DESC
      LIMIT ?
    `;
    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }
}

module.exports = new DashboardModel();
