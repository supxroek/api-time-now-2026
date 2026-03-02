const db = require("../../../config/db.config");

class TimeRecordModel {
  buildEmployeeFilters(filters = {}) {
    let clause = "";
    const params = [];

    if (filters.department_id) {
      clause += " AND e.department_id = ?";
      params.push(Number(filters.department_id));
    }

    if (filters.search) {
      clause += " AND (e.name LIKE ? OR e.employee_code LIKE ?)";
      const keyword = `%${filters.search}%`;
      params.push(keyword, keyword);
    }

    return { clause, params };
  }

  async getDepartmentOptions(companyId) {
    const query = `
      SELECT d.id, d.department_name
      FROM departments d
      WHERE d.company_id = ?
      ORDER BY d.department_name ASC, d.id ASC
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows;
  }

  async countActiveEmployees(companyId, filters = {}) {
    const employeeFilter = this.buildEmployeeFilters(filters);

    const query = `
      SELECT COUNT(*) AS total
      FROM employees e
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        ${employeeFilter.clause}
    `;

    const [rows] = await db.query(query, [companyId, ...employeeFilter.params]);
    return Number(rows[0]?.total || 0);
  }

  async getOverviewStats(companyId, targetDate, filters = {}) {
    const employeeFilter = this.buildEmployeeFilters(filters);

    const query = `
      SELECT
        COUNT(*) AS total_employees,
        SUM(CASE WHEN ads.attendance_status IN ('normal', 'late', 'early_exit', 'late_and_early_exit') THEN 1 ELSE 0 END) AS came_to_work,
        SUM(CASE WHEN ads.attendance_status IN ('late', 'late_and_early_exit') THEN 1 ELSE 0 END) AS late,
        SUM(CASE WHEN ads.attendance_status = 'absent' THEN 1 ELSE 0 END) AS absent
      FROM employees e
      LEFT JOIN attendance_daily_summaries ads
        ON ads.company_id = e.company_id
       AND ads.employee_id = e.id
       AND ads.work_date = ?
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        ${employeeFilter.clause}
    `;

    const [rows] = await db.query(query, [
      targetDate,
      companyId,
      ...employeeFilter.params,
    ]);
    return (
      rows[0] || {
        total_employees: 0,
        came_to_work: 0,
        late: 0,
        absent: 0,
      }
    );
  }

  buildRealtimeLogFilters(filters = {}) {
    let clause = "";
    const params = [];

    if (filters.start_date) {
      clause += " AND DATE(al.log_timestamp) >= ?";
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      clause += " AND DATE(al.log_timestamp) <= ?";
      params.push(filters.end_date);
    }

    if (filters.department_id) {
      clause += " AND e.department_id = ?";
      params.push(Number(filters.department_id));
    }

    if (filters.log_type) {
      clause += " AND al.log_type = ?";
      params.push(filters.log_type);
    }

    if (filters.search) {
      clause += " AND (e.name LIKE ? OR e.employee_code LIKE ?)";
      const keyword = `%${filters.search}%`;
      params.push(keyword, keyword);
    }

    return { clause, params };
  }

  async getRealtimeLogs(companyId, filters = {}, limit = 50, offset = 0) {
    const filterClause = this.buildRealtimeLogFilters(filters);

    const query = `
      SELECT
        al.id,
        al.company_id,
        al.employee_id,
        al.device_id,
        al.log_type,
        al.log_timestamp,
        al.is_manual,
        e.employee_code,
        e.name AS employee_name,
        e.image_url AS employee_avatar,
        e.department_id,
        d.department_name,
        dv.name AS device_name,
        dv.location_name,
        ads.attendance_status
      FROM attendance_logs al
      JOIN employees e
        ON e.id = al.employee_id
       AND e.company_id = al.company_id
      LEFT JOIN departments d
        ON d.id = e.department_id
       AND d.company_id = e.company_id
      LEFT JOIN devices dv
        ON dv.id = al.device_id
       AND dv.company_id = al.company_id
      LEFT JOIN attendance_daily_summaries ads
        ON ads.company_id = al.company_id
       AND ads.employee_id = al.employee_id
       AND ads.work_date = DATE(al.log_timestamp)
      WHERE al.company_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        ${filterClause.clause}
      ORDER BY al.log_timestamp DESC, al.id DESC
      LIMIT ? OFFSET ?
    `;

    const params = [companyId, ...filterClause.params, limit, offset];
    const [rows] = await db.query(query, params);
    return rows;
  }

  async countRealtimeLogs(companyId, filters = {}) {
    const filterClause = this.buildRealtimeLogFilters(filters);

    const query = `
      SELECT COUNT(*) AS total
      FROM attendance_logs al
      JOIN employees e
        ON e.id = al.employee_id
       AND e.company_id = al.company_id
      WHERE al.company_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        ${filterClause.clause}
    `;

    const [rows] = await db.query(query, [companyId, ...filterClause.params]);
    return Number(rows[0]?.total || 0);
  }

  async getDailySummary(companyId, targetDate, filters = {}) {
    const employeeFilter = this.buildEmployeeFilters(filters);

    const query = `
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.name AS employee_name,
        e.image_url AS employee_avatar,
        d.department_name,
        lp.check_in_time,
        lp.break_start_time,
        lp.break_end_time,
        lp.check_out_time,
        lp.ot_in_time,
        lp.ot_out_time,
        ads.attendance_status AS latest_status
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
       AND d.company_id = e.company_id
      LEFT JOIN (
        SELECT
          al.company_id,
          al.employee_id,
          DATE(al.log_timestamp) AS work_date,
          MIN(CASE WHEN al.log_type = 'check_in' THEN al.log_timestamp END) AS check_in_time,
          MIN(CASE WHEN al.log_type = 'break_start' THEN al.log_timestamp END) AS break_start_time,
          MAX(CASE WHEN al.log_type = 'break_end' THEN al.log_timestamp END) AS break_end_time,
          MAX(CASE WHEN al.log_type = 'check_out' THEN al.log_timestamp END) AS check_out_time,
          MIN(CASE WHEN al.log_type = 'ot_in' THEN al.log_timestamp END) AS ot_in_time,
          MAX(CASE WHEN al.log_type = 'ot_out' THEN al.log_timestamp END) AS ot_out_time
        FROM attendance_logs al
        WHERE al.company_id = ?
          AND DATE(al.log_timestamp) = ?
        GROUP BY al.company_id, al.employee_id, DATE(al.log_timestamp)
      ) lp
        ON lp.company_id = e.company_id
       AND lp.employee_id = e.id
       AND lp.work_date = ?
      LEFT JOIN attendance_daily_summaries ads
        ON ads.company_id = e.company_id
       AND ads.employee_id = e.id
       AND ads.work_date = ?
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        ${employeeFilter.clause}
      ORDER BY e.employee_code ASC, e.id ASC
    `;

    const params = [
      companyId,
      targetDate,
      targetDate,
      targetDate,
      companyId,
      ...employeeFilter.params,
    ];

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findEmployeeById(companyId, employeeId) {
    const query = `
      SELECT id, company_id
      FROM employees
      WHERE id = ?
        AND company_id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `;

    const [rows] = await db.query(query, [employeeId, companyId]);
    return rows[0] || null;
  }

  async getEmployeeHistory(companyId, employeeId, startDate, endDate) {
    const query = `
      SELECT
        ads.work_date AS date,
        logs.check_in_time AS checkIn,
        logs.break_start_time AS breakStart,
        logs.break_end_time AS breakEnd,
        logs.check_out_time AS checkOut,
        logs.ot_in_time AS otCheckIn,
        logs.ot_out_time AS otCheckOut,
        ads.attendance_status AS status,
        ads.total_work_minutes,
        ads.break_minutes,
        ads.late_minutes,
        ads.early_exit_minutes,
        ads.total_ot_minutes
      FROM attendance_daily_summaries ads
      LEFT JOIN (
        SELECT
          al.company_id,
          al.employee_id,
          DATE(al.log_timestamp) AS work_date,
          MIN(CASE WHEN al.log_type = 'check_in' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) AS check_in_time,
          MIN(CASE WHEN al.log_type = 'break_start' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) AS break_start_time,
          MAX(CASE WHEN al.log_type = 'break_end' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) AS break_end_time,
          MAX(CASE WHEN al.log_type = 'check_out' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) AS check_out_time,
          MIN(CASE WHEN al.log_type = 'ot_in' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) AS ot_in_time,
          MAX(CASE WHEN al.log_type = 'ot_out' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) AS ot_out_time
        FROM attendance_logs al
        WHERE al.company_id = ?
          AND al.employee_id = ?
          AND DATE(al.log_timestamp) BETWEEN ? AND ?
        GROUP BY al.company_id, al.employee_id, DATE(al.log_timestamp)
      ) logs
        ON logs.company_id = ads.company_id
       AND logs.employee_id = ads.employee_id
       AND logs.work_date = ads.work_date
      WHERE ads.company_id = ?
        AND ads.employee_id = ?
        AND ads.work_date BETWEEN ? AND ?
      ORDER BY ads.work_date ASC
    `;

    const [rows] = await db.query(query, [
      companyId,
      employeeId,
      startDate,
      endDate,
      companyId,
      employeeId,
      startDate,
      endDate,
    ]);

    return rows;
  }
}

module.exports = new TimeRecordModel();
