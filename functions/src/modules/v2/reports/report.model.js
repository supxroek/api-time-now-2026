const db = require("../../../config/db.config");

class ReportModel {
  buildEmployeeFilters(filters = {}, params = [], employeeAlias = "e") {
    const conditions = [
      `${employeeAlias}.deleted_at IS NULL`,
      `${employeeAlias}.status = 'active'`,
      `${employeeAlias}.resign_date IS NULL`,
    ];

    if (filters.departmentId) {
      conditions.push(`${employeeAlias}.department_id = ?`);
      params.push(filters.departmentId);
    }

    if (filters.search) {
      conditions.push(
        `(${employeeAlias}.name LIKE ? OR ${employeeAlias}.employee_code LIKE ?)`,
      );
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    return conditions.length ? ` AND ${conditions.join(" AND ")}` : "";
  }

  async findEmployeeIdByUserId(companyId, userId) {
    const query = `
      SELECT employee_id
      FROM users
      WHERE id = ?
        AND company_id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [userId, companyId]);
    return rows[0]?.employee_id || null;
  }

  async findEmployeeForReport(companyId, employeeId) {
    const query = `
      SELECT
        e.id,
        e.company_id,
        e.employee_code,
        e.name,
        e.email,
        e.image_url,
        e.department_id,
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

  async getIndividualAggregate(companyId, employeeId, startDate, endDate) {
    const query = `
      SELECT
        COUNT(*) AS total_days,
        (
          SELECT COUNT(*)
          FROM rosters r2
          WHERE r2.company_id = ?
            AND r2.employee_id = ?
            AND r2.work_date BETWEEN ? AND ?
            AND r2.day_type = 'workday'
        ) AS total_required_workdays,
        SUM(CASE WHEN ads.attendance_status = 'present' THEN 1 ELSE 0 END) AS present_days,
        SUM(CASE WHEN ads.attendance_status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
        SUM(CASE WHEN ads.attendance_status = 'leave' THEN 1 ELSE 0 END) AS leave_days,
        SUM(CASE WHEN ads.attendance_status = 'holiday' THEN 1 ELSE 0 END) AS holiday_days,
        SUM(CASE WHEN ads.attendance_status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete_days,
        COALESCE(SUM(ads.total_work_minutes), 0) AS total_work_minutes,
        COALESCE(SUM(ads.total_ot_minutes), 0) AS total_ot_minutes,
        COALESCE(SUM(ads.late_minutes), 0) AS total_late_minutes,
        COALESCE(SUM(ads.early_exit_minutes), 0) AS total_early_exit_minutes
      FROM attendance_daily_summaries ads
      JOIN employees e
        ON e.id = ads.employee_id
       AND e.company_id = ads.company_id
      WHERE ads.company_id = ?
        AND ads.employee_id = ?
        AND ads.work_date BETWEEN ? AND ?
        AND e.deleted_at IS NULL
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

    return rows[0] || null;
  }

  async countIndividualDailyRecords(companyId, employeeId, startDate, endDate) {
    const query = `
      SELECT COUNT(*) AS total
      FROM attendance_daily_summaries ads
      JOIN employees e
        ON e.id = ads.employee_id
       AND e.company_id = ads.company_id
      WHERE ads.company_id = ?
        AND ads.employee_id = ?
        AND ads.work_date BETWEEN ? AND ?
        AND e.deleted_at IS NULL
    `;

    const [rows] = await db.query(query, [
      companyId,
      employeeId,
      startDate,
      endDate,
    ]);

    return Number(rows[0]?.total || 0);
  }

  async listIndividualDailyRecords(
    companyId,
    employeeId,
    startDate,
    endDate,
    limit,
    offset,
  ) {
    const query = `
      SELECT
        ads.work_date,
        ads.attendance_status,
        COALESCE(al.first_check_in, ads.first_check_in) AS first_check_in,
        al.break_start_at,
        al.break_end_at,
        COALESCE(al.check_out_at, ads.last_check_out) AS check_out_at,
        al.ot_in_at,
        al.ot_out_at,
        ads.last_check_out,
        ads.total_work_minutes,
        ads.break_minutes,
        ads.late_minutes,
        ads.early_exit_minutes,
        ads.total_ot_minutes,
        r.day_type,
        r.source_system,
        s.id AS shift_id,
        s.name AS shift_name,
        s.start_time AS shift_start_time,
        s.end_time AS shift_end_time
      FROM attendance_daily_summaries ads
      JOIN employees e
        ON e.id = ads.employee_id
       AND e.company_id = ads.company_id
      LEFT JOIN rosters r
        ON r.id = ads.roster_id
       AND r.company_id = ads.company_id
      LEFT JOIN shifts s
        ON s.id = r.shift_id
       AND s.company_id = ads.company_id
      LEFT JOIN (
        SELECT
          company_id,
          roster_id,
          MIN(CASE WHEN log_type = 'check_in' THEN log_timestamp END) AS first_check_in,
          MIN(CASE WHEN log_type = 'break_start' THEN log_timestamp END) AS break_start_at,
          MAX(CASE WHEN log_type = 'break_end' THEN log_timestamp END) AS break_end_at,
          MAX(CASE WHEN log_type = 'check_out' THEN log_timestamp END) AS check_out_at,
          MIN(CASE WHEN log_type = 'ot_in' THEN log_timestamp END) AS ot_in_at,
          MAX(CASE WHEN log_type = 'ot_out' THEN log_timestamp END) AS ot_out_at
        FROM attendance_logs
        WHERE company_id = ?
        GROUP BY company_id, roster_id
      ) al
        ON al.company_id = ads.company_id
       AND al.roster_id = ads.roster_id
      WHERE ads.company_id = ?
        AND ads.employee_id = ?
        AND ads.work_date BETWEEN ? AND ?
        AND e.deleted_at IS NULL
      ORDER BY ads.work_date DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db.query(query, [
      companyId,
      companyId,
      employeeId,
      startDate,
      endDate,
      limit,
      offset,
    ]);

    return rows;
  }

  async countEmployeeSummaryRows(companyId, startDate, endDate, filters = {}) {
    const params = [companyId, startDate, endDate];
    const filterSql = this.buildEmployeeFilters(filters, params);

    const query = `
      SELECT COUNT(DISTINCT ads.employee_id) AS total
      FROM attendance_daily_summaries ads
      JOIN employees e
        ON e.id = ads.employee_id
       AND e.company_id = ads.company_id
      WHERE ads.company_id = ?
        AND ads.work_date BETWEEN ? AND ?
        ${filterSql}
    `;

    const [rows] = await db.query(query, params);
    return Number(rows[0]?.total || 0);
  }

  async listEmployeeSummaryRows(
    companyId,
    startDate,
    endDate,
    limit,
    offset,
    filters = {},
  ) {
    const params = [
      companyId,
      startDate,
      endDate,
      companyId,
      startDate,
      endDate,
    ];
    const filterSql = this.buildEmployeeFilters(filters, params);

    const query = `
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.name AS employee_name,
        e.image_url AS employee_avatar,
        e.department_id,
        d.department_name,
        COUNT(*) AS total_days,
        COALESCE(rr.total_required_workdays, 0) AS total_required_workdays,
        SUM(CASE WHEN ads.attendance_status = 'present' THEN 1 ELSE 0 END) AS present_days,
        SUM(CASE WHEN ads.attendance_status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
        SUM(CASE WHEN ads.attendance_status = 'leave' THEN 1 ELSE 0 END) AS leave_days,
        SUM(CASE WHEN ads.attendance_status = 'holiday' THEN 1 ELSE 0 END) AS holiday_days,
        SUM(CASE WHEN ads.attendance_status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete_days,
        COALESCE(SUM(ads.total_work_minutes), 0) AS total_work_minutes,
        COALESCE(SUM(ads.total_ot_minutes), 0) AS total_ot_minutes,
        COALESCE(SUM(ads.late_minutes), 0) AS total_late_minutes,
        COALESCE(SUM(ads.early_exit_minutes), 0) AS total_early_exit_minutes
      FROM attendance_daily_summaries ads
      JOIN employees e
        ON e.id = ads.employee_id
       AND e.company_id = ads.company_id
      LEFT JOIN departments d
        ON d.id = e.department_id
       AND d.company_id = e.company_id
      LEFT JOIN (
        SELECT
          employee_id,
          COUNT(*) AS total_required_workdays
        FROM rosters
        WHERE company_id = ?
          AND work_date BETWEEN ? AND ?
          AND day_type = 'workday'
        GROUP BY employee_id
      ) rr
        ON rr.employee_id = e.id
      WHERE ads.company_id = ?
        AND ads.work_date BETWEEN ? AND ?
        ${filterSql}
      GROUP BY
        e.id,
        e.employee_code,
        e.name,
        e.image_url,
        e.department_id,
        d.department_name
      ORDER BY e.name ASC, e.id ASC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const [rows] = await db.query(query, params);
    return rows;
  }

  async getEmployeeSummaryAggregate(
    companyId,
    startDate,
    endDate,
    filters = {},
  ) {
    const params = [
      companyId,
      startDate,
      endDate,
      companyId,
      startDate,
      endDate,
    ];
    const filterSql = this.buildEmployeeFilters(filters, params);
    const rosterFilterSql = this.buildEmployeeFilters(filters, params, "re");

    const query = `
      SELECT
        COUNT(DISTINCT ads.employee_id) AS total_employees,
        COUNT(*) AS total_days,
        (
          SELECT COUNT(*)
          FROM rosters rr
          JOIN employees re
            ON re.id = rr.employee_id
           AND re.company_id = rr.company_id
          WHERE rr.company_id = ?
            AND rr.work_date BETWEEN ? AND ?
            AND rr.day_type = 'workday'
            ${rosterFilterSql}
        ) AS total_required_workdays,
        SUM(CASE WHEN ads.attendance_status = 'present' THEN 1 ELSE 0 END) AS present_days,
        SUM(CASE WHEN ads.attendance_status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
        SUM(CASE WHEN ads.attendance_status = 'leave' THEN 1 ELSE 0 END) AS leave_days,
        SUM(CASE WHEN ads.attendance_status = 'holiday' THEN 1 ELSE 0 END) AS holiday_days,
        SUM(CASE WHEN ads.attendance_status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete_days,
        COALESCE(SUM(ads.total_work_minutes), 0) AS total_work_minutes,
        COALESCE(SUM(ads.total_ot_minutes), 0) AS total_ot_minutes,
        COALESCE(SUM(ads.late_minutes), 0) AS total_late_minutes,
        COALESCE(SUM(ads.early_exit_minutes), 0) AS total_early_exit_minutes
      FROM attendance_daily_summaries ads
      JOIN employees e
        ON e.id = ads.employee_id
       AND e.company_id = ads.company_id
      WHERE ads.company_id = ?
        AND ads.work_date BETWEEN ? AND ?
        ${filterSql}
    `;

    const [rows] = await db.query(query, params);
    return rows[0] || null;
  }

  async countDailyAttendanceRows(companyId, startDate, endDate, filters = {}) {
    const params = [companyId, startDate, endDate];
    const filterSql = this.buildEmployeeFilters(filters, params);

    const query = `
      SELECT COUNT(DISTINCT r.work_date) AS total
      FROM rosters r
      JOIN employees e
        ON e.id = r.employee_id
       AND e.company_id = r.company_id
      WHERE r.company_id = ?
        AND r.work_date BETWEEN ? AND ?
        AND r.day_type = 'workday'
        ${filterSql}
    `;

    const [rows] = await db.query(query, params);
    return Number(rows[0]?.total || 0);
  }

  async listDailyAttendanceRows(
    companyId,
    startDate,
    endDate,
    limit,
    offset,
    filters = {},
  ) {
    const params = [companyId, startDate, endDate];
    const filterSql = this.buildEmployeeFilters(filters, params);

    const query = `
      SELECT
        r.work_date,
        COUNT(DISTINCT r.employee_id) AS total_employees,
        SUM(CASE WHEN ads.attendance_status = 'present' THEN 1 ELSE 0 END) AS present_count,
        SUM(CASE WHEN ads.attendance_status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN ads.attendance_status = 'leave' THEN 1 ELSE 0 END) AS leave_count,
        SUM(CASE WHEN ads.attendance_status = 'holiday' THEN 1 ELSE 0 END) AS holiday_count,
        SUM(CASE WHEN ads.attendance_status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete_count,
        COALESCE(SUM(ads.total_work_minutes), 0) AS total_work_minutes,
        COALESCE(SUM(ads.total_ot_minutes), 0) AS total_ot_minutes,
        COALESCE(SUM(ads.late_minutes), 0) AS total_late_minutes,
        COALESCE(SUM(ads.early_exit_minutes), 0) AS total_early_exit_minutes
      FROM rosters r
      JOIN employees e
        ON e.id = r.employee_id
       AND e.company_id = r.company_id
      LEFT JOIN attendance_daily_summaries ads
        ON ads.company_id = r.company_id
       AND ads.employee_id = r.employee_id
       AND ads.work_date = r.work_date
      WHERE r.company_id = ?
        AND r.work_date BETWEEN ? AND ?
        AND r.day_type = 'workday'
        ${filterSql}
      GROUP BY r.work_date
      ORDER BY r.work_date DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const [rows] = await db.query(query, params);
    return rows;
  }

  async getDailyAttendanceAggregate(
    companyId,
    startDate,
    endDate,
    filters = {},
  ) {
    const params = [companyId, startDate, endDate];
    const filterSql = this.buildEmployeeFilters(filters, params);

    const query = `
      SELECT
        COUNT(DISTINCT ads.work_date) AS total_days,
        COUNT(DISTINCT ads.employee_id) AS unique_employees,
        COUNT(*) AS total_records,
        SUM(CASE WHEN ads.attendance_status = 'present' THEN 1 ELSE 0 END) AS present_count,
        SUM(CASE WHEN ads.attendance_status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN ads.attendance_status = 'leave' THEN 1 ELSE 0 END) AS leave_count,
        SUM(CASE WHEN ads.attendance_status = 'holiday' THEN 1 ELSE 0 END) AS holiday_count,
        SUM(CASE WHEN ads.attendance_status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete_count,
        COALESCE(SUM(ads.total_work_minutes), 0) AS total_work_minutes,
        COALESCE(SUM(ads.total_ot_minutes), 0) AS total_ot_minutes,
        COALESCE(SUM(ads.late_minutes), 0) AS total_late_minutes,
        COALESCE(SUM(ads.early_exit_minutes), 0) AS total_early_exit_minutes
      FROM attendance_daily_summaries ads
      JOIN employees e
        ON e.id = ads.employee_id
       AND e.company_id = ads.company_id
      WHERE ads.company_id = ?
        AND ads.work_date BETWEEN ? AND ?
        ${filterSql}
    `;

    const [rows] = await db.query(query, params);
    return rows[0] || null;
  }
}

module.exports = new ReportModel();
