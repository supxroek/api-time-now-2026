const db = require("../../../config/db.config");

class StatsModel {
  async getAllStats(companyId) {
    const query = `
      SELECT
        (SELECT COUNT(*) FROM employees e WHERE e.company_id = ? AND e.deleted_at IS NULL AND e.resign_date IS NULL) AS employees_total,
        (SELECT COUNT(*) FROM attendance_daily_summaries ads WHERE ads.company_id = ? AND ads.work_date = CURDATE() AND ads.attendance_status IN ('late', 'late_and_early_exit')) AS late_today,
        (SELECT COUNT(*) FROM attendance_daily_summaries ads WHERE ads.company_id = ? AND ads.work_date = CURDATE() AND ads.attendance_status = 'absent') AS absent_today,

        (SELECT COUNT(*) FROM attendance_daily_summaries ads WHERE ads.company_id = ? AND ads.work_date = CURDATE() AND ads.attendance_status IN ('normal', 'late', 'early_exit', 'late_and_early_exit')) AS present_today,
        (SELECT COUNT(*) FROM requests r WHERE r.company_id = ? AND r.status = 'pending') AS pending_requests,

        (SELECT COUNT(*) FROM attendance_daily_summaries ads WHERE ads.company_id = ? AND ads.work_date = CURDATE() AND ads.attendance_status = 'normal') AS on_time_today,

        (SELECT COUNT(*) FROM requests r WHERE r.company_id = ?) AS requests_total,
        (SELECT COUNT(*) FROM requests r WHERE r.company_id = ? AND r.status = 'pending') AS requests_pending,
        (SELECT COUNT(*) FROM requests r WHERE r.company_id = ? AND r.status = 'approved') AS requests_approved,
        (SELECT COUNT(*) FROM requests r WHERE r.company_id = ? AND r.status = 'rejected') AS requests_rejected,

        (SELECT COUNT(*) FROM departments d WHERE d.company_id = ?) AS departments_total,
        (SELECT COUNT(*) FROM employees e WHERE e.company_id = ? AND e.deleted_at IS NULL) AS departments_employee_total,
        (SELECT COUNT(*) FROM departments d WHERE d.company_id = ? AND d.head_employee_id IS NOT NULL) AS departments_heads_total,

        (SELECT COUNT(*) FROM ot_templates ot WHERE ot.company_id = ? AND ot.deleted_at IS NULL) AS ot_total,
        (SELECT COUNT(*) FROM ot_templates ot WHERE ot.company_id = ? AND ot.deleted_at IS NULL AND ot.is_active = 1) AS ot_active,
        (SELECT COUNT(*) FROM ot_templates ot WHERE ot.company_id = ? AND ot.deleted_at IS NULL AND ot.is_active = 0) AS ot_inactive,
        (SELECT COALESCE(SUM(ads.total_ot_minutes), 0) FROM attendance_daily_summaries ads WHERE ads.company_id = ?) AS ot_usage_total,

        (SELECT COUNT(*) FROM devices dv WHERE dv.company_id = ? AND dv.deleted_at IS NULL) AS devices_total,
        (SELECT COUNT(*) FROM devices dv WHERE dv.company_id = ? AND dv.deleted_at IS NULL AND dv.is_active = 1) AS devices_online,
        (SELECT COUNT(*) FROM devices dv WHERE dv.company_id = ? AND dv.deleted_at IS NULL AND dv.is_active = 0) AS devices_offline,
        (SELECT COUNT(DISTINCT dac.device_id)
           FROM devices dv
           JOIN device_access_controls dac ON dac.device_id = dv.id
          WHERE dv.company_id = ?
            AND dv.deleted_at IS NULL) AS devices_assigned,

        (SELECT COUNT(*) FROM users u WHERE u.company_id = ?) AS users_total,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = ? AND u.is_active = 1) AS users_active,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = ? AND u.role = 'admin') AS users_admin,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = ? AND u.role = 'manager') AS users_manager,

        (SELECT COUNT(*) FROM audit_trail at2 WHERE at2.company_id = ?) AS audit_total,
        (SELECT COUNT(*) FROM audit_trail at2 WHERE at2.company_id = ? AND at2.action_type = 'INSERT') AS audit_insert_total,
        (SELECT COUNT(*) FROM audit_trail at2 WHERE at2.company_id = ? AND at2.action_type = 'UPDATE') AS audit_update_total,
        (SELECT COUNT(*) FROM audit_trail at2 WHERE at2.company_id = ? AND at2.action_type = 'DELETE') AS audit_delete_total
    `;

    const params = Array.from({ length: 31 }, () => companyId);
    const [rows] = await db.query(query, params);
    return rows[0] || null;
  }
}

module.exports = new StatsModel();
