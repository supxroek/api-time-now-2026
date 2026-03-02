const db = require("../../../config/db.config");

class DayResolutionModel {
  async findActiveEmployeesByCompany(companyId, employeeId = null) {
    let query = `
      SELECT
        id,
        company_id,
        name,
        id_or_passport_number,
        status
      FROM employees
      WHERE company_id = ?
        AND deleted_at IS NULL
        AND status IN ('active', 'suspended')
    `;

    const params = [companyId];

    if (employeeId) {
      query += " AND id = ?";
      params.push(employeeId);
    }

    query += " ORDER BY id ASC";

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findEmployeeById(companyId, employeeId, executor = db) {
    const query = `
      SELECT
        id,
        company_id,
        name,
        id_or_passport_number,
        status
      FROM employees
      WHERE company_id = ?
        AND id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `;

    const [rows] = await executor.query(query, [companyId, employeeId]);
    return rows[0] || null;
  }

  async findLeaveHubIntegration(companyId, executor = db) {
    const query = `
      SELECT
        id,
        company_id,
        credential_payload,
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

    const [rows] = await executor.query(query, [companyId]);
    return rows[0] || null;
  }

  async findRosterByEmployeeAndDate(
    companyId,
    employeeId,
    workDate,
    executor = db,
    forUpdate = false,
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
        source_payload_hash,
        sync_version,
        resolved_at
      FROM rosters
      WHERE company_id = ?
        AND employee_id = ?
        AND work_date = ?
      LIMIT 1
    `;

    if (forUpdate) {
      query += " FOR UPDATE";
    }

    const [rows] = await executor.query(query, [
      companyId,
      employeeId,
      workDate,
    ]);
    return rows[0] || null;
  }

  async findEffectiveDayoffAssignment(
    companyId,
    employeeId,
    workDate,
    executor = db,
  ) {
    const query = `
      SELECT
        id,
        dayoff_mode,
        weekly_days,
        effective_from,
        effective_to
      FROM employee_dayoff_assignments
      WHERE company_id = ?
        AND employee_id = ?
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC
      LIMIT 1
    `;

    const [rows] = await executor.query(query, [
      companyId,
      employeeId,
      workDate,
      workDate,
    ]);
    return rows[0] || null;
  }

  async findCustomDayoffByDate(companyId, employeeId, workDate, executor = db) {
    const query = `
      SELECT id
      FROM employee_dayoff_custom_days
      WHERE company_id = ?
        AND employee_id = ?
        AND off_date = ?
      LIMIT 1
    `;

    const [rows] = await executor.query(query, [
      companyId,
      employeeId,
      workDate,
    ]);
    return rows[0] || null;
  }

  async findEffectiveShiftAssignment(
    companyId,
    employeeId,
    workDate,
    executor = db,
  ) {
    const query = `
      SELECT
        id,
        shift_mode,
        shift_id,
        effective_from,
        effective_to
      FROM employee_shift_assignments
      WHERE company_id = ?
        AND employee_id = ?
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC
      LIMIT 1
    `;

    const [rows] = await executor.query(query, [
      companyId,
      employeeId,
      workDate,
      workDate,
    ]);

    return rows[0] || null;
  }

  async findCustomShiftByDate(companyId, employeeId, workDate, executor = db) {
    const query = `
      SELECT shift_id
      FROM employee_shift_custom_days
      WHERE company_id = ?
        AND employee_id = ?
        AND work_date = ?
      LIMIT 1
    `;

    const [rows] = await executor.query(query, [
      companyId,
      employeeId,
      workDate,
    ]);
    return rows[0] || null;
  }

  async insertRosterSnapshot(payload, executor = db) {
    const query = `
      INSERT INTO rosters (
        company_id,
        employee_id,
        work_date,
        shift_id,
        day_type,
        source_system,
        leave_hours_data,
        is_ot_allowed,
        source_payload_hash,
        sync_version,
        resolved_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
    `;

    const [result] = await executor.query(query, [
      payload.company_id,
      payload.employee_id,
      payload.work_date,
      payload.shift_id || null,
      payload.day_type,
      payload.source_system,
      payload.leave_hours_data
        ? JSON.stringify(payload.leave_hours_data)
        : null,
      payload.is_ot_allowed ?? 0,
      payload.source_payload_hash || null,
    ]);

    return result.insertId;
  }

  async upsertAttendanceSummaryFromRoster(payload, executor = db) {
    const query = `
      INSERT INTO attendance_daily_summaries (
        company_id,
        employee_id,
        roster_id,
        work_date,
        attendance_status,
        calculated_at
      )
      VALUES (?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        roster_id = VALUES(roster_id),
        attendance_status = VALUES(attendance_status),
        calculated_at = NOW()
    `;

    await executor.query(query, [
      payload.company_id,
      payload.employee_id,
      payload.roster_id,
      payload.work_date,
      payload.attendance_status,
    ]);
  }

  async insertAuditTrail(payload, executor = db) {
    const query = `
      INSERT INTO audit_trail (
        company_id,
        user_id,
        action_type,
        table_name,
        record_id,
        old_values,
        new_values,
        ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await executor.query(query, [
      payload.company_id,
      payload.user_id,
      payload.action_type,
      payload.table_name,
      payload.record_id,
      payload.old_values ? JSON.stringify(payload.old_values) : null,
      payload.new_values ? JSON.stringify(payload.new_values) : null,
      payload.ip_address || null,
    ]);
  }
}

module.exports = new DayResolutionModel();
