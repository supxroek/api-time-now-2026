const db = require("../../../config/db.config");

class RosterV2Model {
  async findEmployeesForOverview(companyId, search = "") {
    let query = `
      SELECT
        e.id,
        e.company_id,
        e.employee_code,
        e.name,
        e.status,
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
    `;

    const params = [companyId];

    if (search) {
      query += `
        AND (
          e.name LIKE ?
          OR e.employee_code LIKE ?
        )
      `;
      const keyword = `%${search}%`;
      params.push(keyword, keyword);
    }

    query += " ORDER BY e.name ASC";

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findDayoffCustomDaysForOverview(
    companyId,
    startDate,
    endDate,
    employeeId = null,
  ) {
    let query = `
      SELECT
        employee_id,
        off_date
      FROM employee_dayoff_custom_days
      WHERE company_id = ?
        AND off_date BETWEEN ? AND ?
    `;

    const params = [companyId, startDate, endDate];

    if (employeeId) {
      query += " AND employee_id = ?";
      params.push(employeeId);
    }

    query += " ORDER BY off_date ASC, employee_id ASC";

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findShiftsForOverview(companyId) {
    const query = `
      SELECT
        id,
        company_id,
        name,
        type,
        start_time,
        end_time,
        is_break,
        break_start_time,
        break_end_time,
        is_night_shift
      FROM shifts
      WHERE company_id = ?
        AND deleted_at IS NULL
      ORDER BY id ASC
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows;
  }

  async findRostersForOverview(
    companyId,
    startDate,
    endDate,
    employeeId = null,
  ) {
    let query = `
      SELECT
        id,
        company_id,
        employee_id,
        work_date,
        shift_id,
        day_type,
        source_system,
        leave_hours_data,
        is_ot_allowed,
        resolved_at
      FROM rosters
      WHERE company_id = ?
        AND work_date BETWEEN ? AND ?
    `;

    const params = [companyId, startDate, endDate];

    if (employeeId) {
      query += " AND employee_id = ?";
      params.push(employeeId);
    }

    query += " ORDER BY work_date DESC, employee_id ASC";

    const [rows] = await db.query(query, params);
    return rows;
  }
}

module.exports = new RosterV2Model();
