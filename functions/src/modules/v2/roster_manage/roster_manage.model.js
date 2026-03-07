const db = require("../../../config/db.config");

class RosterManageV2Model {
  getExecutor(executor) {
    return executor || db;
  }

  async findEmployeesForMode(companyId, modeType, filters = {}) {
    const byOffDays = modeType === "off_days";

    let query = `
			SELECT
				e.id,
				e.employee_code,
				e.name,
				e.image_url,
				e.department_id,
				d.department_name,
				e.status,
				esa.shift_mode,
				esa.shift_id AS default_shift_id,
				eda.dayoff_mode,
				eda.weekly_days
			FROM employees e
			LEFT JOIN departments d
				ON d.id = e.department_id
			 AND d.company_id = e.company_id
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
				AND ${byOffDays ? "eda.dayoff_mode = 'custom'" : "esa.shift_mode = 'custom'"}
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

    query += " ORDER BY e.name ASC";

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

  async findLeavehubIntegrationStatus(companyId, executor) {
    const exec = this.getExecutor(executor);
    const query = `
			SELECT
				integration_type,
				status,
				activated_at,
				deactivated_at,
				last_sync_at,
				sync_status,
				sync_error_message
			FROM company_integrations
			WHERE company_id = ?
				AND integration_type = 'leavehub'
			LIMIT 1
		`;

    const [rows] = await exec.query(query, [companyId]);
    return rows[0] || null;
  }

  async findRostersByDateRange(companyId, startDate, endDate, modeType) {
    const byOffDays = modeType === "off_days";

    const query = `
			SELECT
				r.id,
				r.company_id,
				r.employee_id,
				r.work_date,
				r.shift_id,
				r.day_type,
				r.source_system,
				r.is_ot_allowed,
				r.resolved_at
			FROM rosters r
			INNER JOIN employees e
				ON e.id = r.employee_id
			 AND e.company_id = r.company_id
			 AND e.deleted_at IS NULL
			 AND e.resign_date IS NULL
			LEFT JOIN employee_shift_assignments esa
				ON esa.company_id = e.company_id
			 AND esa.employee_id = e.id
			 AND esa.effective_to IS NULL
			LEFT JOIN employee_dayoff_assignments eda
				ON eda.company_id = e.company_id
			 AND eda.employee_id = e.id
			 AND eda.effective_to IS NULL
			WHERE r.company_id = ?
				AND r.work_date BETWEEN ? AND ?
				AND ${byOffDays ? "eda.dayoff_mode = 'custom'" : "esa.shift_mode = 'custom'"}
			ORDER BY r.work_date ASC, r.employee_id ASC
		`;

    const [rows] = await db.query(query, [companyId, startDate, endDate]);
    return rows;
  }

  async findDayoffCustomDaysByDateRange(
    companyId,
    startDate,
    endDate,
    modeType,
  ) {
    const byOffDays = modeType === "off_days";

    const query = `
			SELECT
				d.id,
				d.company_id,
				d.employee_id,
				d.off_date,
				d.note,
				d.created_by,
				d.created_at
			FROM employee_dayoff_custom_days d
			INNER JOIN employees e
				ON e.id = d.employee_id
			 AND e.company_id = d.company_id
			 AND e.deleted_at IS NULL
			 AND e.resign_date IS NULL
			LEFT JOIN employee_shift_assignments esa
				ON esa.company_id = e.company_id
			 AND esa.employee_id = e.id
			 AND esa.effective_to IS NULL
			LEFT JOIN employee_dayoff_assignments eda
				ON eda.company_id = e.company_id
			 AND eda.employee_id = e.id
			 AND eda.effective_to IS NULL
			WHERE d.company_id = ?
				AND d.off_date BETWEEN ? AND ?
				AND ${byOffDays ? "eda.dayoff_mode = 'custom'" : "esa.shift_mode = 'custom'"}
			ORDER BY d.off_date ASC, d.employee_id ASC
		`;

    const [rows] = await db.query(query, [companyId, startDate, endDate]);
    return rows;
  }

  async findEmployeeByIdAndMode(companyId, employeeId, modeType, executor) {
    const exec = this.getExecutor(executor);
    const byOffDays = modeType === "off_days";

    const query = `
			SELECT
				e.id,
				e.company_id,
				esa.shift_mode,
				eda.dayoff_mode
			FROM employees e
			LEFT JOIN employee_shift_assignments esa
				ON esa.company_id = e.company_id
			 AND esa.employee_id = e.id
			 AND esa.effective_to IS NULL
			LEFT JOIN employee_dayoff_assignments eda
				ON eda.company_id = e.company_id
			 AND eda.employee_id = e.id
			 AND eda.effective_to IS NULL
			WHERE e.id = ?
				AND e.company_id = ?
				AND e.deleted_at IS NULL
				AND e.resign_date IS NULL
				AND ${byOffDays ? "eda.dayoff_mode = 'custom'" : "esa.shift_mode = 'custom'"}
			LIMIT 1
		`;

    const [rows] = await exec.query(query, [Number(employeeId), companyId]);
    return rows[0] || null;
  }

  async findShiftById(companyId, shiftId, executor) {
    const exec = this.getExecutor(executor);
    const query = `
			SELECT id, company_id, name, start_time, end_time
			FROM shifts
			WHERE id = ?
				AND company_id = ?
				AND deleted_at IS NULL
			LIMIT 1
		`;
    const [rows] = await exec.query(query, [Number(shiftId), companyId]);
    return rows[0] || null;
  }

  async findShiftCustomDayByEmployeeAndDate(
    companyId,
    employeeId,
    workDate,
    executor,
  ) {
    const exec = this.getExecutor(executor);
    const query = `
			SELECT
				id,
				company_id,
				employee_id,
				work_date,
				shift_id,
				created_by,
				created_at
			FROM employee_shift_custom_days
			WHERE company_id = ?
				AND employee_id = ?
				AND work_date = ?
			LIMIT 1
		`;

    const [rows] = await exec.query(query, [
      companyId,
      Number(employeeId),
      workDate,
    ]);
    return rows[0] || null;
  }

  async upsertShiftCustomDay(
    companyId,
    employeeId,
    workDate,
    shiftId,
    createdBy,
    executor,
  ) {
    const exec = this.getExecutor(executor);
    const query = `
			INSERT INTO employee_shift_custom_days (
				company_id,
				employee_id,
				work_date,
				shift_id,
				created_by
			)
			VALUES (?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				shift_id = VALUES(shift_id)
		`;

    await exec.query(query, [
      companyId,
      Number(employeeId),
      workDate,
      Number(shiftId),
      Number(createdBy),
    ]);
  }

  async deleteShiftCustomDayByEmployeeAndDate(
    companyId,
    employeeId,
    workDate,
    executor,
  ) {
    const exec = this.getExecutor(executor);
    const query = `
			DELETE FROM employee_shift_custom_days
			WHERE company_id = ?
				AND employee_id = ?
				AND work_date = ?
		`;
    const [result] = await exec.query(query, [
      companyId,
      Number(employeeId),
      workDate,
    ]);
    return result.affectedRows || 0;
  }

  async findRosterByEmployeeAndDate(companyId, employeeId, workDate, executor) {
    const exec = this.getExecutor(executor);
    const query = `
			SELECT
				id,
				company_id,
				employee_id,
				work_date,
				shift_id,
				day_type,
				source_system,
				is_ot_allowed,
				resolved_at
			FROM rosters
			WHERE company_id = ?
				AND employee_id = ?
				AND work_date = ?
			LIMIT 1
		`;
    const [rows] = await exec.query(query, [
      companyId,
      Number(employeeId),
      workDate,
    ]);
    return rows[0] || null;
  }

  async upsertWorkdayRoster(
    companyId,
    employeeId,
    workDate,
    shiftId,
    executor,
  ) {
    const exec = this.getExecutor(executor);
    const query = `
			INSERT INTO rosters (
				company_id,
				employee_id,
				work_date,
				shift_id,
				day_type,
				source_system,
				is_ot_allowed
			)
			VALUES (?, ?, ?, ?, 'workday', 'local', 0)
			ON DUPLICATE KEY UPDATE
				shift_id = VALUES(shift_id),
				day_type = 'workday',
				source_system = 'local',
				is_ot_allowed = VALUES(is_ot_allowed)
		`;

    await exec.query(query, [
      companyId,
      Number(employeeId),
      workDate,
      Number(shiftId),
    ]);
  }

  async upsertWeeklyOffRoster(companyId, employeeId, workDate, executor) {
    const exec = this.getExecutor(executor);
    const query = `
			INSERT INTO rosters (
				company_id,
				employee_id,
				work_date,
				shift_id,
				day_type,
				source_system,
				is_ot_allowed
			)
			VALUES (?, ?, ?, NULL, 'weekly_off', 'local', 0)
			ON DUPLICATE KEY UPDATE
				shift_id = NULL,
				day_type = 'weekly_off',
				source_system = 'local',
				is_ot_allowed = VALUES(is_ot_allowed)
		`;

    await exec.query(query, [companyId, Number(employeeId), workDate]);
  }

  async deleteRosterById(id, companyId, executor) {
    const exec = this.getExecutor(executor);
    const query = `
			DELETE FROM rosters
			WHERE id = ?
				AND company_id = ?
		`;
    const [result] = await exec.query(query, [Number(id), companyId]);
    return result.affectedRows || 0;
  }

  async findDayoffCustomDayByEmployeeAndDate(
    companyId,
    employeeId,
    offDate,
    executor,
  ) {
    const exec = this.getExecutor(executor);
    const query = `
			SELECT
				id,
				company_id,
				employee_id,
				off_date,
				note,
				created_by,
				created_at
			FROM employee_dayoff_custom_days
			WHERE company_id = ?
				AND employee_id = ?
				AND off_date = ?
			LIMIT 1
		`;

    const [rows] = await exec.query(query, [
      companyId,
      Number(employeeId),
      offDate,
    ]);
    return rows[0] || null;
  }

  async upsertDayoffCustomDay(
    companyId,
    employeeId,
    offDate,
    createdBy,
    executor,
  ) {
    const exec = this.getExecutor(executor);
    const query = `
			INSERT INTO employee_dayoff_custom_days (
				company_id,
				employee_id,
				off_date,
				note,
				created_by
			)
			VALUES (?, ?, ?, NULL, ?)
			ON DUPLICATE KEY UPDATE
				note = VALUES(note)
		`;

    await exec.query(query, [
      companyId,
      Number(employeeId),
      offDate,
      Number(createdBy),
    ]);
  }

  async deleteDayoffCustomDayById(id, companyId, executor) {
    const exec = this.getExecutor(executor);
    const query = `
			DELETE FROM employee_dayoff_custom_days
			WHERE id = ?
				AND company_id = ?
		`;
    const [result] = await exec.query(query, [Number(id), companyId]);
    return result.affectedRows || 0;
  }
}

module.exports = new RosterManageV2Model();
