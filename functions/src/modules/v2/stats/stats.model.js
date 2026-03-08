const db = require("../../../config/db.config");

class StatsModel {
  buildEmployeeSearchFilter(search = "") {
    if (!search) {
      return { clause: "", params: [] };
    }

    const keyword = `%${search}%`;
    return {
      clause: " AND (e.name LIKE ? OR e.employee_code LIKE ? OR d.department_name LIKE ?)",
      params: [keyword, keyword, keyword],
    };
  }

  async getIndividualSummary(companyId, filters = {}, limit = 200, offset = 0) {
    const searchFilter = this.buildEmployeeSearchFilter(filters.search);

    const query = `
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.name AS employee_name,
        d.department_name,
        COUNT(ads.id) AS total_days,
        SUM(CASE WHEN ads.attendance_status IN ('normal', 'late', 'early_exit', 'late_and_early_exit') THEN 1 ELSE 0 END) AS present_days,
        SUM(CASE WHEN ads.attendance_status = 'normal' THEN 1 ELSE 0 END) AS normal_days,
        SUM(CASE WHEN ads.attendance_status IN ('late', 'late_and_early_exit') THEN 1 ELSE 0 END) AS late_days,
        SUM(CASE WHEN ads.attendance_status IN ('early_exit', 'late_and_early_exit') THEN 1 ELSE 0 END) AS early_exit_days,
        SUM(CASE WHEN ads.attendance_status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
        SUM(CASE WHEN ads.attendance_status = 'leave' THEN 1 ELSE 0 END) AS leave_days,
        SUM(CASE WHEN ads.attendance_status = 'holiday' THEN 1 ELSE 0 END) AS holiday_days,
        SUM(CASE WHEN ads.attendance_status IN ('late', 'late_and_early_exit') THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN ads.attendance_status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN ads.attendance_status = 'leave' THEN 1 ELSE 0 END) AS leave_count,
        COALESCE(SUM(ads.total_ot_minutes), 0) AS total_ot_minutes,
        ROUND(COALESCE(SUM(ads.total_ot_minutes), 0) / 60, 2) AS ot_hours,
        ROUND(
          COALESCE(
            AVG(
              CASE
                WHEN ads.attendance_status IN ('normal', 'late', 'early_exit', 'late_and_early_exit')
                  THEN ads.total_work_minutes / 60
                ELSE NULL
              END
            ),
            0
          ),
          2
        ) AS avg_work_hours,
        CASE
          WHEN (
            SUM(CASE WHEN ads.attendance_status IN ('normal', 'late', 'early_exit', 'late_and_early_exit') THEN 1 ELSE 0 END)
            + SUM(CASE WHEN ads.attendance_status = 'absent' THEN 1 ELSE 0 END)
            + SUM(CASE WHEN ads.attendance_status = 'leave' THEN 1 ELSE 0 END)
          ) = 0 THEN 0
          ELSE ROUND(
            (
              SUM(CASE WHEN ads.attendance_status IN ('normal', 'late', 'early_exit', 'late_and_early_exit') THEN 1 ELSE 0 END) * 100
            ) /
            (
              SUM(CASE WHEN ads.attendance_status IN ('normal', 'late', 'early_exit', 'late_and_early_exit') THEN 1 ELSE 0 END)
              + SUM(CASE WHEN ads.attendance_status = 'absent' THEN 1 ELSE 0 END)
              + SUM(CASE WHEN ads.attendance_status = 'leave' THEN 1 ELSE 0 END)
            ),
            2
          )
        END AS attendance_rate
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
       AND d.company_id = e.company_id
      LEFT JOIN attendance_daily_summaries ads
        ON ads.company_id = e.company_id
       AND ads.employee_id = e.id
       AND ads.work_date BETWEEN ? AND ?
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        ${searchFilter.clause}
      GROUP BY e.id, e.employee_code, e.name, d.department_name
      ORDER BY e.employee_code ASC, e.id ASC
      LIMIT ? OFFSET ?
    `;

    const params = [
      filters.start_date,
      filters.end_date,
      companyId,
      ...searchFilter.params,
      limit,
      offset,
    ];

    const [rows] = await db.query(query, params);
    return rows;
  }

  async getDailyAttendanceEmployee(companyId, employeeId) {
    const query = `
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.name AS employee_name,
        d.department_name
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
       AND d.company_id = e.company_id
      WHERE e.company_id = ?
        AND e.id = ?
        AND e.deleted_at IS NULL
      LIMIT 1
    `;

    const [rows] = await db.query(query, [companyId, employeeId]);
    return rows[0] || null;
  }

  async getDailyAttendanceRowsForEmployee(companyId, employeeId, filters = {}) {
    const query = `
      SELECT
        r.work_date,
        r.day_type,
        r.shift_id,
        s.name AS shift_name,
        DATE_FORMAT(s.start_time, '%H:%i') AS shift_start_time,
        DATE_FORMAT(s.end_time, '%H:%i') AS shift_end_time,
        ads.attendance_status,
        DATE_FORMAT(ads.first_check_in, '%H:%i') AS check_in_time,
        DATE_FORMAT(ads.last_check_out, '%H:%i') AS check_out_time,
        ads.late_minutes,
        ads.early_exit_minutes,
        ROUND(COALESCE(ads.total_work_minutes, 0) / 60, 2) AS work_hours,
        ROUND(COALESCE(ads.total_ot_minutes, 0) / 60, 2) AS ot_hours,
        ads.break_minutes
      FROM rosters r
      LEFT JOIN shifts s
        ON s.id = r.shift_id
       AND s.company_id = r.company_id
      LEFT JOIN attendance_daily_summaries ads
        ON ads.company_id = r.company_id
       AND ads.employee_id = r.employee_id
       AND ads.work_date = r.work_date
      WHERE r.company_id = ?
        AND r.employee_id = ?
        AND r.work_date BETWEEN ? AND ?
      ORDER BY r.work_date ASC
    `;

    const [rows] = await db.query(query, [
      companyId,
      employeeId,
      filters.start_date,
      filters.end_date,
    ]);
    return rows;
  }

  async countIndividualSummary(companyId, filters = {}) {
    const searchFilter = this.buildEmployeeSearchFilter(filters.search);

    const query = `
      SELECT COUNT(*) AS total
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
       AND d.company_id = e.company_id
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        ${searchFilter.clause}
    `;

    const [rows] = await db.query(query, [companyId, ...searchFilter.params]);
    return Number(rows[0]?.total || 0);
  }

  async getAllStats(companyId) {
    const query = `
      SELECT
        (SELECT COUNT(*) FROM employees e WHERE e.company_id = ? AND e.deleted_at IS NULL AND e.resign_date IS NULL) AS employees_total,
        (SELECT COUNT(*) FROM attendance_daily_summaries ads WHERE ads.company_id = ? AND ads.work_date = CURDATE() AND ads.attendance_status IN ('late', 'late_and_early_exit')) AS late_today,
        (SELECT COUNT(*) FROM attendance_daily_summaries ads WHERE ads.company_id = ? AND ads.work_date = CURDATE() AND ads.attendance_status = 'absent') AS absent_today,

        (SELECT COUNT(*) FROM attendance_daily_summaries ads WHERE ads.company_id = ? AND ads.work_date = CURDATE() AND ads.attendance_status IN ('normal', 'late', 'early_exit', 'late_and_early_exit')) AS present_today,
        (SELECT COUNT(*) FROM requests r WHERE r.company_id = ? AND r.status = 'pending') AS pending_requests,

        (SELECT COUNT(*) FROM attendance_daily_summaries ads WHERE ads.company_id = ? AND ads.work_date = CURDATE() AND ads.attendance_status = 'normal') AS on_time_today,

        (SELECT COUNT(*) FROM requests r WHERE r.company_id = ?) AS requests_total,
        (SELECT COUNT(*) FROM requests r WHERE r.company_id = ? AND r.status = 'pending') AS requests_pending,
        (SELECT COUNT(*) FROM requests r WHERE r.company_id = ? AND r.status = 'approved') AS requests_approved,
        (SELECT COUNT(*) FROM requests r WHERE r.company_id = ? AND r.status = 'rejected') AS requests_rejected,

        (SELECT COUNT(*) FROM departments d WHERE d.company_id = ?) AS departments_total,
        (SELECT COUNT(*) FROM employees e WHERE e.company_id = ? AND e.deleted_at IS NULL) AS departments_employee_total,
        (SELECT COUNT(*) FROM departments d WHERE d.company_id = ? AND d.head_employee_id IS NOT NULL) AS departments_heads_total,

        (SELECT COUNT(*) FROM ot_templates ot WHERE ot.company_id = ? AND ot.deleted_at IS NULL) AS ot_total,
        (SELECT COUNT(*) FROM ot_templates ot WHERE ot.company_id = ? AND ot.deleted_at IS NULL AND ot.is_active = 1) AS ot_active,
        (SELECT COUNT(*) FROM ot_templates ot WHERE ot.company_id = ? AND ot.deleted_at IS NULL AND ot.is_active = 0) AS ot_inactive,
        (SELECT COALESCE(SUM(ads.total_ot_minutes), 0) FROM attendance_daily_summaries ads WHERE ads.company_id = ?) AS ot_usage_total,

        (SELECT COUNT(*) FROM devices dv WHERE dv.company_id = ? AND dv.deleted_at IS NULL) AS devices_total,
        (SELECT COUNT(*) FROM devices dv WHERE dv.company_id = ? AND dv.deleted_at IS NULL AND dv.is_active = 1) AS devices_online,
        (SELECT COUNT(*) FROM devices dv WHERE dv.company_id = ? AND dv.deleted_at IS NULL AND dv.is_active = 0) AS devices_offline,
        (SELECT COUNT(DISTINCT dac.device_id)
           FROM devices dv
           JOIN device_access_controls dac ON dac.device_id = dv.id
          WHERE dv.company_id = ?
            AND dv.deleted_at IS NULL) AS devices_assigned,

        (SELECT COUNT(*) FROM users u WHERE u.company_id = ?) AS users_total,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = ? AND u.is_active = 1) AS users_active,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = ? AND u.role = 'admin') AS users_admin,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = ? AND u.role = 'manager') AS users_manager,

        (SELECT COUNT(*) FROM audit_trail at2 WHERE at2.company_id = ?) AS audit_total,
        (SELECT COUNT(*) FROM audit_trail at2 WHERE at2.company_id = ? AND at2.action_type = 'INSERT') AS audit_insert_total,
        (SELECT COUNT(*) FROM audit_trail at2 WHERE at2.company_id = ? AND at2.action_type = 'UPDATE') AS audit_update_total,
        (SELECT COUNT(*) FROM audit_trail at2 WHERE at2.company_id = ? AND at2.action_type = 'DELETE') AS audit_delete_total
    `;

    const params = Array.from({ length: 31 }, () => companyId);
    const [rows] = await db.query(query, params);
    return rows[0] || null;
  }
}

module.exports = new StatsModel();
