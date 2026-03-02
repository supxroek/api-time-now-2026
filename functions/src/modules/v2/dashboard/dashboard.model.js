const db = require("../../../config/db.config");

class DashboardModel {
  async getTodayAttendanceLogs(companyId, limit = 10) {
    const query = `
      SELECT
        al.id,
        al.company_id,
        al.employee_id,
        al.device_id,
        al.log_type,
        al.log_timestamp,
        al.is_manual,
        e.name AS employee_name,
        e.employee_code,
        e.image_url AS employee_avatar
      FROM attendance_logs al
      JOIN employees e
        ON e.id = al.employee_id
       AND e.company_id = al.company_id 
      WHERE al.company_id = ?
        AND DATE(al.log_timestamp) = CURDATE()
      ORDER BY al.log_timestamp DESC
      LIMIT ?
    `;

    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

  async getPendingRequests(companyId, limit = 10) {
    const query = `
      SELECT
        r.id,
        r.company_id,
        r.employee_id,
        r.request_type,
        r.status,
        r.request_data,
        r.target_date,
        r.created_at,
        e.name AS employee_name,
        e.employee_code,
        e.image_url AS employee_avatar
      FROM requests r
      JOIN employees e
        ON e.id = r.employee_id
       AND e.company_id = r.company_id
      WHERE r.company_id = ?
        AND r.status = 'pending'
      ORDER BY r.created_at DESC
      LIMIT ?
    `;

    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }
}

module.exports = new DashboardModel();
