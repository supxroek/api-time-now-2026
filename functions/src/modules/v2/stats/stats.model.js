const db = require("../../../config/db.config");

class StatsModel {
  // function to get all stats
  async getAllStats(companyId) {
    const graceMinutes = Number(process.env.ATTENDANCE_GRACE_MINUTES || 0);

    const queryScalar = async (query, params = []) => {
      const [rows] = await db.query(query, params);
      return Number(rows[0]?.total || 0);
    };

    const [
      employeesTotal,
      presentToday,
      leaveOrHolidayToday,
      pendingRequests,
      lateAndOnTimeRows,
      requestsTotal,
      requestsPending,
      requestsApproved,
      requestsRejected,
      departmentsTotal,
      departmentsEmployeeTotal,
      departmentsHeadsTotal,
      otTotal,
      otActive,
      otInactive,
      otUsageTotal,
      devicesTotal,
      devicesOnline,
      devicesOffline,
      devicesAssigned,
      usersTotal,
      usersActive,
      usersAdmin,
      usersManager,
      auditTotal,
      auditInsertTotal,
      auditUpdateTotal,
      auditDeleteTotal,
    ] = await Promise.all([
      queryScalar(
        `
          SELECT COUNT(*) AS total
          FROM employees e
          WHERE e.company_id = ?
            AND e.deleted_at IS NULL
            AND e.status = 'active'
            AND e.resign_date IS NULL
        `,
        [companyId],
      ),
      queryScalar(
        `
          SELECT COUNT(DISTINCT al.employee_id) AS total
          FROM attendance_logs al
          JOIN employees e
            ON e.id = al.employee_id
           AND e.company_id = al.company_id
          WHERE al.company_id = ?
            AND DATE(al.log_timestamp) = CURDATE()
            AND e.deleted_at IS NULL
            AND e.status = 'active'
            AND e.resign_date IS NULL
        `,
        [companyId],
      ),
      queryScalar(
        `
          SELECT COUNT(DISTINCT r.employee_id) AS total
          FROM rosters r
          JOIN employees e
            ON e.id = r.employee_id
           AND e.company_id = r.company_id
          WHERE r.company_id = ?
            AND r.work_date = CURDATE()
            AND r.day_type IN (
              'weekly_off',
              'public_holiday',
              'compensated_holiday',
              'holiday_swap',
              'annual_leave',
              'sick_leave',
              'private_leave',
              'unpaid_leave',
              'other_leave'
            )
            AND e.deleted_at IS NULL
            AND e.status = 'active'
            AND e.resign_date IS NULL
        `,
        [companyId],
      ),
      queryScalar(
        `
          SELECT COUNT(*) AS total
          FROM requests r
          WHERE r.company_id = ?
            AND r.status = 'pending'
        `,
        [companyId],
      ),
      db.query(
        `
          SELECT
            SUM(
              CASE
                WHEN x.shift_start IS NOT NULL
                  AND TIMESTAMPDIFF(
                    MINUTE,
                    TIMESTAMP(CURDATE(), x.shift_start),
                    x.first_check_in
                  ) > ?
                THEN 1
                ELSE 0
              END
            ) AS late_today,
            SUM(
              CASE
                WHEN x.shift_start IS NOT NULL
                  AND TIMESTAMPDIFF(
                    MINUTE,
                    TIMESTAMP(CURDATE(), x.shift_start),
                    x.first_check_in
                  ) <= ?
                THEN 1
                ELSE 0
              END
            ) AS on_time_today
          FROM (
            SELECT
              fc.employee_id,
              fc.first_check_in,
              s.start_time AS shift_start
            FROM (
              SELECT
                al.employee_id,
                MIN(al.log_timestamp) AS first_check_in
              FROM attendance_logs al
              JOIN employees e
                ON e.id = al.employee_id
               AND e.company_id = al.company_id
              WHERE al.company_id = ?
                AND DATE(al.log_timestamp) = CURDATE()
                AND al.log_type = 'check_in'
                AND e.deleted_at IS NULL
                AND e.status = 'active'
                AND e.resign_date IS NULL
              GROUP BY al.employee_id
            ) fc
            JOIN employees e
              ON e.id = fc.employee_id
             AND e.company_id = ?
            LEFT JOIN rosters r
              ON r.company_id = ?
             AND r.employee_id = fc.employee_id
             AND r.work_date = CURDATE()
            LEFT JOIN shifts s
              ON s.id = r.shift_id
             AND s.company_id = r.company_id
            WHERE e.deleted_at IS NULL
              AND e.status = 'active'
              AND e.resign_date IS NULL
          ) x
        `,
        [graceMinutes, graceMinutes, companyId, companyId, companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM requests r WHERE r.company_id = ?`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM requests r WHERE r.company_id = ? AND r.status = 'pending'`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM requests r WHERE r.company_id = ? AND r.status = 'approved'`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM requests r WHERE r.company_id = ? AND r.status = 'rejected'`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM departments d WHERE d.company_id = ?`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM employees e WHERE e.company_id = ? AND e.deleted_at IS NULL`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM departments d WHERE d.company_id = ? AND d.head_employee_id IS NOT NULL`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM ot_templates ot WHERE ot.company_id = ? AND ot.deleted_at IS NULL`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM ot_templates ot WHERE ot.company_id = ? AND ot.deleted_at IS NULL AND ot.is_active = 1`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM ot_templates ot WHERE ot.company_id = ? AND ot.deleted_at IS NULL AND ot.is_active = 0`,
        [companyId],
      ),
      queryScalar(
        `
          SELECT COALESCE(SUM(ot.duration_minutes), 0) AS total
          FROM requests r
          JOIN ot_templates ot
            ON ot.id = r.ot_template_id
           AND ot.company_id = r.company_id
          WHERE r.company_id = ?
            AND r.request_type = 'ot'
            AND r.status = 'approved'
        `,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM devices dv WHERE dv.company_id = ? AND dv.deleted_at IS NULL`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM devices dv WHERE dv.company_id = ? AND dv.deleted_at IS NULL AND dv.is_active = 1`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM devices dv WHERE dv.company_id = ? AND dv.deleted_at IS NULL AND dv.is_active = 0`,
        [companyId],
      ),
      queryScalar(
        `
          SELECT COUNT(DISTINCT dac.device_id) AS total
          FROM devices dv
          JOIN device_access_controls dac
            ON dac.device_id = dv.id
          WHERE dv.company_id = ?
            AND dv.deleted_at IS NULL
        `,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM users u WHERE u.company_id = ?`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM users u WHERE u.company_id = ? AND u.is_active = 1`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM users u WHERE u.company_id = ? AND u.role = 'admin'`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM users u WHERE u.company_id = ? AND u.role = 'manager'`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM audit_trail at2 WHERE at2.company_id = ?`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM audit_trail at2 WHERE at2.company_id = ? AND at2.action_type = 'INSERT'`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM audit_trail at2 WHERE at2.company_id = ? AND at2.action_type = 'UPDATE'`,
        [companyId],
      ),
      queryScalar(
        `SELECT COUNT(*) AS total FROM audit_trail at2 WHERE at2.company_id = ? AND at2.action_type = 'DELETE'`,
        [companyId],
      ),
    ]);

    const lateAndOnTime = lateAndOnTimeRows?.[0]?.[0] || {};
    const lateToday = Number(lateAndOnTime.late_today || 0);
    const onTimeToday = Number(lateAndOnTime.on_time_today || 0);

    return {
      employees_total: employeesTotal,
      late_today: lateToday,
      absent_today: Math.max(
        employeesTotal - presentToday - leaveOrHolidayToday,
        0,
      ),
      present_today: presentToday,
      pending_requests: pendingRequests,
      on_time_today: onTimeToday,

      requests_total: requestsTotal,
      requests_pending: requestsPending,
      requests_approved: requestsApproved,
      requests_rejected: requestsRejected,

      departments_total: departmentsTotal,
      departments_employee_total: departmentsEmployeeTotal,
      departments_heads_total: departmentsHeadsTotal,

      ot_total: otTotal,
      ot_active: otActive,
      ot_inactive: otInactive,
      ot_usage_total: otUsageTotal,

      devices_total: devicesTotal,
      devices_online: devicesOnline,
      devices_offline: devicesOffline,
      devices_assigned: devicesAssigned,

      users_total: usersTotal,
      users_active: usersActive,
      users_admin: usersAdmin,
      users_manager: usersManager,

      audit_total: auditTotal,
      audit_insert_total: auditInsertTotal,
      audit_update_total: auditUpdateTotal,
      audit_delete_total: auditDeleteTotal,
    };
  }
}

module.exports = new StatsModel();
