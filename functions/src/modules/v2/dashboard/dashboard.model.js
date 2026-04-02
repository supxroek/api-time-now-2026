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
        al.log_status,
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
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND e.resign_date IS NULL
      ORDER BY al.log_timestamp DESC
      LIMIT ?
    `;

    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

  async countTodayAttendanceLogs(companyId) {
    const query = `
      SELECT COUNT(*) AS total
      FROM attendance_logs al
      JOIN employees e
        ON e.id = al.employee_id
       AND e.company_id = al.company_id
      WHERE al.company_id = ?
        AND DATE(al.log_timestamp) = CURDATE()
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND e.resign_date IS NULL
    `;

    const [rows] = await db.query(query, [companyId]);
    return Number(rows[0]?.total || 0);
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

  async countPendingRequests(companyId) {
    const query = `
      SELECT COUNT(*) AS total
      FROM requests r
      JOIN employees e
        ON e.id = r.employee_id
       AND e.company_id = r.company_id
      WHERE r.company_id = ?
        AND r.status = 'pending'
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND e.resign_date IS NULL
    `;

    const [rows] = await db.query(query, [companyId]);
    return Number(rows[0]?.total || 0);
  }
}

module.exports = new DashboardModel();
