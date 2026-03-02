const db = require("../../../config/db.config");

class IntegrationModel {
  isPacketTooLargeError(error) {
    const message = String(error?.message || "").toLowerCase();

    return (
      error?.code === "ER_NET_PACKET_TOO_LARGE" ||
      error?.errno === 1153 ||
      message.includes("max_allowed_packet") ||
      message.includes("packet too large")
    );
  }

  buildBulkRosterInsertQuery(payloads) {
    const valuesSql = payloads
      .map(() => "(?, ?, ?, NULL, ?, 'leavehub', ?, 0, ?, 1, NOW())")
      .join(", ");

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
      VALUES ${valuesSql}
      ON DUPLICATE KEY UPDATE
        day_type = VALUES(day_type),
        source_system = VALUES(source_system),
        leave_hours_data = VALUES(leave_hours_data),
        source_payload_hash = VALUES(source_payload_hash),
        sync_version = sync_version + 1,
        resolved_at = NOW()
    `;

    const params = [];
    payloads.forEach((payload) => {
      params.push(
        payload.company_id,
        payload.employee_id,
        payload.work_date,
        payload.day_type,
        payload.leave_hours_data
          ? JSON.stringify(payload.leave_hours_data)
          : null,
        payload.source_payload_hash || null,
      );
    });

    return { query, params };
  }

  async executeBulkRosterUpsertWithFallback(payloads, executor = db) {
    if (!Array.isArray(payloads) || !payloads.length) {
      return {
        affectedRows: 0,
        usedFallback: false,
        batchesExecuted: 0,
      };
    }

    const { query, params } = this.buildBulkRosterInsertQuery(payloads);

    try {
      const [result] = await executor.query(query, params);
      return {
        affectedRows: result.affectedRows || 0,
        usedFallback: false,
        batchesExecuted: 1,
      };
    } catch (error) {
      if (!this.isPacketTooLargeError(error) || payloads.length === 1) {
        throw error;
      }

      const middleIndex = Math.ceil(payloads.length / 2);
      const leftPayloads = payloads.slice(0, middleIndex);
      const rightPayloads = payloads.slice(middleIndex);

      const leftResult = await this.executeBulkRosterUpsertWithFallback(
        leftPayloads,
        executor,
      );
      const rightResult = await this.executeBulkRosterUpsertWithFallback(
        rightPayloads,
        executor,
      );

      return {
        affectedRows: leftResult.affectedRows + rightResult.affectedRows,
        usedFallback: true,
        batchesExecuted:
          leftResult.batchesExecuted + rightResult.batchesExecuted,
      };
    }
  }

  async findLeaveHubIntegration(companyId, executor = db) {
    const query = `
      SELECT
        id,
        company_id,
        integration_type,
        credential_payload,
        status,
        activated_at,
        deactivated_at,
        last_sync_at,
        sync_status,
        sync_error_message,
        created_at,
        updated_at
      FROM company_integrations
      WHERE company_id = ?
        AND integration_type = 'leavehub'
      LIMIT 1
    `;

    const [rows] = await executor.query(query, [companyId]);
    return rows[0] || null;
  }

  async createLeaveHubIntegration(payload, executor = db) {
    const query = `
      INSERT INTO company_integrations (
        company_id,
        integration_type,
        credential_payload,
        status,
        activated_at,
        deactivated_at,
        last_sync_at,
        sync_status,
        sync_error_message
      )
      VALUES (?, 'leavehub', ?, 'active', NOW(), NULL, NULL, NULL, NULL)
    `;

    const [result] = await executor.query(query, [
      payload.company_id,
      JSON.stringify(payload.credential_payload),
    ]);

    return result.insertId;
  }

  async updateLeaveHubIntegration(id, payload, executor = db) {
    const query = `
      UPDATE company_integrations
      SET
        credential_payload = ?,
        status = 'active',
        activated_at = NOW(),
        deactivated_at = NULL,
        sync_error_message = NULL,
        updated_at = NOW()
      WHERE id = ?
    `;

    await executor.query(query, [
      JSON.stringify(payload.credential_payload),
      id,
    ]);
  }

  async deactivateLeaveHubIntegration(id, executor = db) {
    const query = `
      UPDATE company_integrations
      SET
        status = 'inactive',
        deactivated_at = NOW(),
        sync_status = NULL,
        sync_error_message = NULL,
        updated_at = NOW()
      WHERE id = ?
    `;

    await executor.query(query, [id]);
  }

  async updateSyncState(id, payload, executor = db) {
    const query = `
      UPDATE company_integrations
      SET
        sync_status = ?,
        sync_error_message = ?,
        last_sync_at = ?,
        updated_at = NOW()
      WHERE id = ?
    `;

    await executor.query(query, [
      payload.sync_status || null,
      payload.sync_error_message || null,
      payload.last_sync_at || null,
      id,
    ]);
  }

  async deleteIntegration(id, executor = db) {
    const query = `
      DELETE FROM company_integrations
      WHERE id = ?
    `;

    await executor.query(query, [id]);
  }

  async findFutureLeaveHubRosterIds(companyId, startDate, executor = db) {
    const query = `
      SELECT id
      FROM rosters
      WHERE company_id = ?
        AND source_system = 'leavehub'
        AND work_date >= ?
    `;

    const [rows] = await executor.query(query, [companyId, startDate]);
    return rows.map((row) => Number(row.id));
  }

  async findEmployeesForLeaveHubMapping(companyId, executor = db) {
    const query = `
      SELECT
        id,
        id_or_passport_number,
        status,
        deleted_at
      FROM employees
      WHERE company_id = ?
        AND deleted_at IS NULL
        AND status IN ('active', 'suspended')
    `;

    const [rows] = await executor.query(query, [companyId]);
    return rows;
  }

  async upsertLeaveHubRoster(payload, executor = db) {
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
      VALUES (?, ?, ?, NULL, ?, 'leavehub', ?, 0, ?, 1, NOW())
      ON DUPLICATE KEY UPDATE
        day_type = VALUES(day_type),
        source_system = VALUES(source_system),
        leave_hours_data = VALUES(leave_hours_data),
        source_payload_hash = VALUES(source_payload_hash),
        sync_version = sync_version + 1,
        resolved_at = NOW()
    `;

    await executor.query(query, [
      payload.company_id,
      payload.employee_id,
      payload.work_date,
      payload.day_type,
      payload.leave_hours_data
        ? JSON.stringify(payload.leave_hours_data)
        : null,
      payload.source_payload_hash || null,
    ]);
  }

  async upsertLeaveHubRostersBulk(payloads, executor = db) {
    const result = await this.executeBulkRosterUpsertWithFallback(
      payloads,
      executor,
    );

    return result;
  }

  async recalculateFutureLeaveHubRostersToLocal(
    companyId,
    startDate,
    executor = db,
  ) {
    const query = `
      UPDATE rosters r
      LEFT JOIN employee_dayoff_assignments eda
        ON eda.company_id = r.company_id
        AND eda.employee_id = r.employee_id
        AND eda.effective_from <= r.work_date
        AND (eda.effective_to IS NULL OR eda.effective_to >= r.work_date)
      LEFT JOIN employee_dayoff_custom_days edcd
        ON edcd.company_id = r.company_id
        AND edcd.employee_id = r.employee_id
        AND edcd.off_date = r.work_date
      SET
        r.day_type = CASE
          WHEN eda.dayoff_mode = 'custom' AND edcd.id IS NOT NULL THEN 'weekly_off'
          WHEN eda.dayoff_mode = 'normal'
            AND JSON_CONTAINS(
              COALESCE(eda.weekly_days, JSON_ARRAY()),
              JSON_QUOTE(ELT(DAYOFWEEK(r.work_date), 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'))
            )
          THEN 'weekly_off'
          ELSE 'workday'
        END,
        r.leave_hours_data = NULL,
        r.source_system = 'local',
        r.sync_version = r.sync_version + 1,
        r.resolved_at = NOW()
      WHERE r.company_id = ?
        AND r.source_system = 'leavehub'
        AND r.work_date >= ?
    `;

    const [result] = await executor.query(query, [companyId, startDate]);
    return result.affectedRows || 0;
  }

  async recalculateAttendanceSummariesByRosterIds(rosterIds, executor = db) {
    if (!rosterIds.length) {
      return 0;
    }

    const placeholders = rosterIds.map(() => "?").join(", ");

    const query = `
      UPDATE attendance_daily_summaries ads
      JOIN rosters r ON r.id = ads.roster_id
      SET
        ads.attendance_status = CASE
          WHEN r.day_type IN ('weekly_off', 'public_holiday', 'compensated_holiday', 'holiday_swap') THEN 'holiday'
          WHEN r.day_type IN ('annual_leave', 'sick_leave', 'private_leave', 'unpaid_leave', 'other_leave') THEN 'leave'
          ELSE 'pending'
        END,
        ads.calculated_at = NOW()
      WHERE ads.roster_id IN (${placeholders})
    `;

    const [result] = await executor.query(query, rosterIds);
    return result.affectedRows || 0;
  }

  async recalculateAttendanceSummariesByEmployeeDateRange(
    companyId,
    employeeIds,
    startDate,
    endDate,
    executor = db,
  ) {
    if (!employeeIds.length) {
      return 0;
    }

    const placeholders = employeeIds.map(() => "?").join(", ");

    const query = `
      UPDATE attendance_daily_summaries ads
      JOIN rosters r ON r.id = ads.roster_id
      SET
        ads.attendance_status = CASE
          WHEN r.day_type IN ('weekly_off', 'public_holiday', 'compensated_holiday', 'holiday_swap') THEN 'holiday'
          WHEN r.day_type IN ('annual_leave', 'sick_leave', 'private_leave', 'unpaid_leave', 'other_leave') THEN 'leave'
          ELSE 'pending'
        END,
        ads.calculated_at = NOW()
      WHERE r.company_id = ?
        AND r.employee_id IN (${placeholders})
        AND r.work_date BETWEEN ? AND ?
    `;

    const [result] = await executor.query(query, [
      companyId,
      ...employeeIds,
      startDate,
      endDate,
    ]);

    return result.affectedRows || 0;
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

module.exports = new IntegrationModel();
