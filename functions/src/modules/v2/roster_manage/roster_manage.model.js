const db = require("../../../config/db.config");

class RosterManageV2Model {
  async findEmployeesForWorkspace(companyId, filters = {}) {
    let query = `
      SELECT
        e.id,
        e.employee_code,
        e.name,
        e.image_url,
        e.department_id,
        esa.shift_mode,
        esa.shift_id AS default_shift_id,
        eda.dayoff_mode,
        eda.weekly_days
      FROM employees e
      LEFT JOIN employee_shift_assignments esa
        ON esa.company_id = e.company_id
       AND esa.employee_id = e.id
       AND esa.effective_to IS NULL
      LEFT JOIN employee_dayoff_assignments eda
        ON eda.company_id = e.company_id
       AND eda.employee_id = e.id
       AND eda.effective_to IS NULL
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
        AND e.resign_date IS NULL
        AND COALESCE(esa.shift_mode, 'normal') = 'custom'
        AND COALESCE(eda.dayoff_mode, 'normal') = 'custom'
    `;

    const params = [companyId];

    if (filters.search) {
      query += " AND (e.name LIKE ? OR e.employee_code LIKE ?)";
      const keyword = `%${filters.search}%`;
      params.push(keyword, keyword);
    }

    if (filters.department_id) {
      query += " AND e.department_id = ?";
      params.push(Number(filters.department_id));
    }

    query += " ORDER BY e.name ASC, e.id ASC";

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findDepartments(companyId) {
    const [rows] = await db.query(
      `
        SELECT id, department_name
        FROM departments
        WHERE company_id = ?
        ORDER BY department_name ASC
      `,
      [companyId],
    );

    return rows;
  }

  async findShifts(companyId) {
    const [rows] = await db.query(
      `
        SELECT id, name, start_time, end_time
        FROM shifts
        WHERE company_id = ?
          AND deleted_at IS NULL
        ORDER BY name ASC, id ASC
      `,
      [companyId],
    );

    return rows;
  }

  async findRostersByDateRange(
    companyId,
    startDate,
    endDate,
    employeeIds = [],
  ) {
    let query = `
      SELECT
        r.id,
        r.company_id,
        r.employee_id,
        r.work_date,
        r.shift_id,
        r.day_type,
        r.source_system,
        r.resolved_at
      FROM rosters r
      WHERE r.company_id = ?
        AND r.work_date BETWEEN ? AND ?
    `;

    const params = [companyId, startDate, endDate];

    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      query += ` AND r.employee_id IN (${employeeIds.map(() => "?").join(",")})`;
      params.push(...employeeIds);
    }

    query += " ORDER BY r.work_date ASC, r.employee_id ASC";

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findAttendanceFlagsByDateRange(
    companyId,
    startDate,
    endDate,
    employeeIds = [],
  ) {
    let query = `
      SELECT
        ads.employee_id,
        ads.work_date,
        ads.first_check_in,
        ads.last_check_out,
        ads.attendance_status
      FROM attendance_daily_summaries ads
      WHERE ads.company_id = ?
        AND ads.work_date BETWEEN ? AND ?
    `;

    const params = [companyId, startDate, endDate];

    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      query += ` AND ads.employee_id IN (${employeeIds.map(() => "?").join(",")})`;
      params.push(...employeeIds);
    }

    query += " ORDER BY ads.work_date ASC, ads.employee_id ASC";

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findEmployeeByIdForWorkspace(companyId, employeeId) {
    const [rows] = await db.query(
      `
        SELECT
          e.id,
          esa.shift_mode,
          esa.shift_id AS default_shift_id,
          eda.dayoff_mode,
          eda.weekly_days
        FROM employees e
        LEFT JOIN employee_shift_assignments esa
          ON esa.company_id = e.company_id
         AND esa.employee_id = e.id
         AND esa.effective_to IS NULL
        LEFT JOIN employee_dayoff_assignments eda
          ON eda.company_id = e.company_id
         AND eda.employee_id = e.id
         AND eda.effective_to IS NULL
        WHERE e.company_id = ?
          AND e.id = ?
          AND e.deleted_at IS NULL
          AND e.resign_date IS NULL
          AND COALESCE(esa.shift_mode, 'normal') = 'custom'
          AND COALESCE(eda.dayoff_mode, 'normal') = 'custom'
        LIMIT 1
      `,
      [companyId, employeeId],
    );

    return rows[0] || null;
  }

  async findShiftById(companyId, shiftId) {
    const [rows] = await db.query(
      `
        SELECT id
        FROM shifts
        WHERE company_id = ?
          AND id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [companyId, shiftId],
    );

    return rows[0] || null;
  }

  async findRosterByEmployeeAndDate(
    companyId,
    employeeId,
    workDate,
    executor = db,
  ) {
    const [rows] = await executor.query(
      `
        SELECT id, employee_id, work_date, shift_id, day_type, source_system
        FROM rosters
        WHERE company_id = ?
          AND employee_id = ?
          AND work_date = ?
        LIMIT 1
      `,
      [companyId, employeeId, workDate],
    );

    return rows[0] || null;
  }

  async upsertLocalRosterCell(
    companyId,
    employeeId,
    workDate,
    shiftId,
    dayType,
    executor = db,
  ) {
    const [result] = await executor.query(
      `
        INSERT INTO rosters (
          company_id,
          employee_id,
          work_date,
          shift_id,
          day_type,
          source_system,
          is_ot_allowed
        )
        VALUES (?, ?, ?, ?, ?, 'local', 0)
        ON DUPLICATE KEY UPDATE
          shift_id = VALUES(shift_id),
          day_type = VALUES(day_type),
          source_system = VALUES(source_system),
          resolved_at = NOW()
      `,
      [companyId, employeeId, workDate, shiftId, dayType],
    );

    return result;
  }

  async deleteRosterByEmployeeAndDate(
    companyId,
    employeeId,
    workDate,
    executor = db,
  ) {
    await executor.query(
      `
        DELETE FROM rosters
        WHERE company_id = ?
          AND employee_id = ?
          AND work_date = ?
      `,
      [companyId, employeeId, workDate],
    );
  }
}

module.exports = new RosterManageV2Model();
