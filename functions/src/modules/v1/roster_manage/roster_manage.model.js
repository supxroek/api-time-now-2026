const db = require("../../../config/db.config");

class RosterManageModel {
  async findEmployeesForMode(companyId, modeType, filters = {}) {
    let query = `
      SELECT
        e.id,
        e.employee_code,
        e.name,
        e.image_url,
        e.department_id,
        e.shift_mode,
        e.dayOff_mode,
        e.weekly_holidays,
        e.status
      FROM employees e
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
        AND e.resign_date IS NULL
    `;

    const params = [companyId];

    if (modeType === "off_days") {
      query += ` AND e.dayOff_mode = 'custom'`;
    } else {
      query += ` AND e.shift_mode = 'custom'`;
    }

    if (filters.search) {
      query += ` AND (e.name LIKE ? OR e.employee_code LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    if (filters.department_id) {
      query += ` AND e.department_id = ?`;
      params.push(filters.department_id);
    }

    query += ` ORDER BY e.name ASC`;

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findDepartments(companyId) {
    const query = `
      SELECT id, department_name
      FROM departments
      WHERE company_id = ?
      ORDER BY department_name ASC
    `;
    const [rows] = await db.query(query, [companyId]);
    return rows;
  }

  async findShifts(companyId) {
    const query = `
      SELECT id, name, start_time, end_time
      FROM shifts
      WHERE company_id = ?
        AND deleted_at IS NULL
      ORDER BY name ASC
    `;
    const [rows] = await db.query(query, [companyId]);
    return rows;
  }

  async findRostersByDateRange(companyId, startDate, endDate, modeType) {
    const query = `
      SELECT r.id, r.employee_id, r.shift_id, r.work_date
      FROM rosters r
      INNER JOIN employees e ON r.employee_id = e.id
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
        AND e.resign_date IS NULL
        AND ${modeType === "off_days" ? "e.dayOff_mode = 'custom'" : "e.shift_mode = 'custom'"}
        AND r.work_date BETWEEN ? AND ?
      ORDER BY r.work_date ASC, r.employee_id ASC
    `;
    const [rows] = await db.query(query, [companyId, startDate, endDate]);
    return rows;
  }

  async findEmployeeByIdAndMode(companyId, employeeId, modeType) {
    let query = `
      SELECT id, company_id, shift_mode, dayOff_mode, weekly_holidays
      FROM employees
      WHERE id = ?
        AND company_id = ?
        AND deleted_at IS NULL
        AND resign_date IS NULL
    `;
    const params = [employeeId, companyId];

    if (modeType === "off_days") {
      query += ` AND dayOff_mode = 'custom'`;
    } else {
      query += ` AND shift_mode = 'custom'`;
    }

    const [rows] = await db.query(query, params);
    return rows[0];
  }

  async updateEmployeeWeeklyHolidays(companyId, employeeId, weeklyHolidays) {
    const query = `
      UPDATE employees
      SET weekly_holidays = ?
      WHERE id = ?
        AND company_id = ?
        AND deleted_at IS NULL
        AND resign_date IS NULL
    `;
    await db.query(query, [
      JSON.stringify(weeklyHolidays),
      employeeId,
      companyId,
    ]);
  }

  async findShiftById(companyId, shiftId) {
    const query = `
      SELECT id, company_id
      FROM shifts
      WHERE id = ?
        AND company_id = ?
        AND deleted_at IS NULL
    `;
    const [rows] = await db.query(query, [shiftId, companyId]);
    return rows[0];
  }

  async findRosterByEmployeeAndDate(companyId, employeeId, workDate) {
    const query = `
      SELECT r.*
      FROM rosters r
      INNER JOIN employees e ON r.employee_id = e.id
      WHERE r.employee_id = ?
        AND r.work_date = ?
        AND e.company_id = ?
    `;
    const [rows] = await db.query(query, [employeeId, workDate, companyId]);
    return rows[0];
  }

  async upsertRoster(employeeId, shiftId, workDate) {
    const query = `
      INSERT INTO rosters (employee_id, shift_id, work_date, is_ot_allowed, is_public_holiday, leave_status)
      VALUES (?, ?, ?, 0, 0, 'none')
      ON DUPLICATE KEY UPDATE
        shift_id = VALUES(shift_id),
        is_ot_allowed = VALUES(is_ot_allowed),
        is_public_holiday = VALUES(is_public_holiday),
        leave_status = VALUES(leave_status)
    `;
    await db.query(query, [employeeId, shiftId, workDate]);
  }

  async deleteRosterByEmployeeAndDate(companyId, employeeId, workDate) {
    const query = `
      DELETE r
      FROM rosters r
      INNER JOIN employees e ON r.employee_id = e.id
      WHERE r.employee_id = ?
        AND r.work_date = ?
        AND e.company_id = ?
    `;
    await db.query(query, [employeeId, workDate, companyId]);
  }
}

module.exports = new RosterManageModel();
