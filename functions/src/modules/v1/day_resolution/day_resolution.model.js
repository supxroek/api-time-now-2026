const db = require("../../../config/db.config");

class DayResolutionModel {
  async findActiveEmployeesByCompany(companyId, employeeId = null) {
    let query = `
      SELECT id
      FROM employees
      WHERE company_id = ?
        AND deleted_at IS NULL
        AND status = 'active'
    `;
    const params = [companyId];

    if (employeeId) {
      query += ` AND id = ?`;
      params.push(employeeId);
    }

    query += ` ORDER BY id ASC`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  async findEmployeeContext(companyId, employeeId) {
    const query = `
      SELECT
        e.id,
        e.company_id,
        e.default_shift_id,
        e.shift_mode,
        e.weekly_holidays,
        e.dayOff_mode,
        e.status,
        c.leave_hub_company_id
      FROM employees e
      JOIN companies c ON c.id = e.company_id
      WHERE e.id = ?
        AND e.company_id = ?
        AND e.deleted_at IS NULL
      LIMIT 1
    `;

    const [rows] = await db.query(query, [employeeId, companyId]);
    return rows[0];
  }

  async findRosterByEmployeeAndDate(companyId, employeeId, workDate) {
    const query = `
      SELECT
        r.*,
        s.name AS roster_shift_name,
        s.type AS roster_shift_type,
        s.start_time AS roster_shift_start_time,
        s.end_time AS roster_shift_end_time,
        s.is_break AS roster_shift_is_break,
        s.break_start_time AS roster_shift_break_start_time,
        s.break_end_time AS roster_shift_break_end_time,
        s.is_night_shift AS roster_shift_is_night_shift
      FROM rosters r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN shifts s ON s.id = r.shift_id
      WHERE e.company_id = ?
        AND r.employee_id = ?
        AND r.work_date = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [companyId, employeeId, workDate]);
    return rows[0];
  }

  async findShiftById(companyId, shiftId) {
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
      WHERE id = ?
        AND company_id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `;

    const [rows] = await db.query(query, [shiftId, companyId]);
    return rows[0];
  }
}

module.exports = new DayResolutionModel();
