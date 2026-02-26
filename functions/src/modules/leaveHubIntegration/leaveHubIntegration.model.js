const db = require("../../config/db.config");

class LeaveHubIntegrationModel {
  // ==============================================================
  // ดึงข้อมูล LeaveHub credential ของบริษัท
  async findCompanyLeaveHubCredentials(companyId) {
    const query = `
      SELECT id, leave_hub_company_id, leave_hub_username, leave_hub_password, last_sync_time
      FROM companies
      WHERE id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows[0];
  }

  // ==============================================================
  // บันทึกข้อมูลเชื่อมต่อ LeaveHub ลงตาราง companies
  async updateLeaveHubCredentials(companyId, payload) {
    const query = `
      UPDATE companies
      SET
        leave_hub_company_id = ?,
        leave_hub_username = ?,
        leave_hub_password = ?,
        last_sync_time = ?
      WHERE id = ?
    `;

    await db.query(query, [
      payload.leave_hub_company_id,
      payload.leave_hub_username,
      payload.leave_hub_password,
      payload.last_sync_time,
      companyId,
    ]);
  }

  // ==============================================================
  // อัปเดตเวลาซิงก์ล่าสุด
  async updateLastSyncTime(companyId, lastSyncTime) {
    const query = `
      UPDATE companies
      SET last_sync_time = ?
      WHERE id = ?
    `;

    await db.query(query, [lastSyncTime, companyId]);
  }

  // ==============================================================
  // ยกเลิกการเชื่อมต่อ LeaveHub และล้าง credential
  async clearLeaveHubCredentials(companyId) {
    const query = `
      UPDATE companies
      SET
        leave_hub_company_id = NULL,
        leave_hub_username = NULL,
        leave_hub_password = NULL,
        last_sync_time = NULL
      WHERE id = ?
    `;

    await db.query(query, [companyId]);
  }

  async findEmployeesForLeaveHubMapping(companyId, executor = db) {
    const query = `
      SELECT
        id,
        company_id,
        employee_code,
        id_or_passport_number,
        default_shift_id,
        shift_mode,
        weekly_holidays,
        status
      FROM employees
      WHERE company_id = ?
        AND deleted_at IS NULL
        AND status IN ('active', 'suspended')
    `;

    const [rows] = await executor.query(query, [companyId]);
    return rows;
  }

  async findRostersByEmployeesAndDateRange(
    companyId,
    employeeIds,
    startDate,
    endDate,
    executor = db,
  ) {
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return [];
    }

    const placeholders = employeeIds.map(() => "?").join(", ");
    const query = `
      SELECT
        id,
        company_id,
        employee_id,
        shift_id,
        work_date,
        is_ot_allowed,
        is_public_holiday,
        leave_status,
        leave_hours_data,
        is_holiday_swap,
        is_compensatory,
        source_system,
        base_day_type
      FROM rosters
      WHERE company_id = ?
        AND employee_id IN (${placeholders})
        AND work_date BETWEEN ? AND ?
    `;

    const [rows] = await executor.query(query, [
      companyId,
      ...employeeIds,
      startDate,
      endDate,
    ]);
    return rows;
  }

  async upsertRosterSnapshot(payload, executor = db) {
    const query = `
      INSERT INTO rosters (
        company_id,
        employee_id,
        shift_id,
        work_date,
        is_ot_allowed,
        is_public_holiday,
        leave_status,
        leave_hours_data,
        is_holiday_swap,
        is_compensatory,
        source_system,
        base_day_type,
        source_payload_hash,
        sync_version,
        resolved_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        shift_id = VALUES(shift_id),
        is_ot_allowed = VALUES(is_ot_allowed),
        is_public_holiday = VALUES(is_public_holiday),
        leave_status = VALUES(leave_status),
        leave_hours_data = VALUES(leave_hours_data),
        is_holiday_swap = VALUES(is_holiday_swap),
        is_compensatory = VALUES(is_compensatory),
        source_system = VALUES(source_system),
        base_day_type = VALUES(base_day_type),
        source_payload_hash = VALUES(source_payload_hash),
        sync_version = VALUES(sync_version),
        resolved_at = NOW()
    `;

    const leaveHoursData = payload.leave_hours_data
      ? JSON.stringify(payload.leave_hours_data)
      : null;

    await executor.query(query, [
      payload.company_id,
      payload.employee_id,
      payload.shift_id,
      payload.work_date,
      payload.is_ot_allowed ?? 0,
      payload.is_public_holiday ?? 0,
      payload.leave_status || "none",
      leaveHoursData,
      payload.is_holiday_swap ?? 0,
      payload.is_compensatory ?? 0,
      payload.source_system || "leave_hub",
      payload.base_day_type || "working_day",
      payload.source_payload_hash || null,
      payload.sync_version || 1,
    ]);
  }
}

module.exports = new LeaveHubIntegrationModel();
