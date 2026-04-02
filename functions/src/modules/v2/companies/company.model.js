const db = require("../../../config/db.config");

class CompanyModel {
  async findProfileByCompanyId(companyId) {
    const query = `
      SELECT * FROM companies WHERE id = ? LIMIT 1
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows[0] || null;
  }

  async getHasDepartmentByCompanyId(companyId) {
    const query = `
      SELECT id, has_department
      FROM companies
      WHERE id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows[0] || null;
  }

  async updateProfileByCompanyId(companyId, data) {
    const keys = Object.keys(data);
    if (!keys.length) {
      return;
    }

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => data[key]);

    const query = `
      UPDATE companies
      SET ${setClause}
      WHERE id = ?
    `;

    await db.query(query, [...values, companyId]);
  }

  async updateHasDepartmentByCompanyId(companyId, hasDepartment) {
    const query = `
      UPDATE companies
      SET has_department = ?
      WHERE id = ?
    `;

    await db.query(query, [hasDepartment, companyId]);
  }

  async listEmployeesForOverview(companyId, limit = 1000) {
    const query = `
      SELECT
        e.id,
        e.company_id,
        e.employee_code,
        e.department_id,
        e.name,
        e.email,
        e.image_url,
        e.phone_number,
        e.status,
        e.start_date,
        e.resign_date,
        d.department_name
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
       AND d.company_id = e.company_id
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
      ORDER BY e.name ASC, e.id ASC
      LIMIT ?
    `;

    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

  async listDepartmentsForOverview(companyId, limit = 500) {
    const query = `
      SELECT
        d.id,
        d.company_id,
        d.department_name,
        d.head_employee_id,
        e.name AS head_employee_name,
        e.employee_code AS head_employee_code,
        COUNT(emp.id) AS employee_count
      FROM departments d
      LEFT JOIN employees e
        ON e.id = d.head_employee_id
       AND e.company_id = d.company_id
       AND e.deleted_at IS NULL
      LEFT JOIN employees emp
        ON emp.department_id = d.id
       AND emp.company_id = d.company_id
       AND emp.deleted_at IS NULL
      WHERE d.company_id = ?
      GROUP BY
        d.id,
        d.company_id,
        d.department_name,
        d.head_employee_id,
        e.name,
        e.employee_code
      ORDER BY d.department_name ASC, d.id ASC
      LIMIT ?
    `;

    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

  async listDevicesForOverview(companyId, limit = 500) {
    const query = `
      SELECT
        d.id,
        d.company_id,
        d.name,
        d.location_name,
        d.description,
        d.hwid,
        d.passcode,
        d.is_active,
        d.deleted_at,
        MAX(al.log_timestamp) AS last_sync,
        (
          SELECT COUNT(*)
          FROM device_access_controls dac
          WHERE dac.device_id = d.id
        ) AS access_control_count
      FROM devices d
      LEFT JOIN attendance_logs al
        ON al.device_id = d.id
       AND al.company_id = d.company_id
      WHERE d.company_id = ?
        AND d.deleted_at IS NULL
      GROUP BY
        d.id,
        d.company_id,
        d.name,
        d.location_name,
        d.description,
        d.hwid,
        d.passcode,
        d.is_active,
        d.deleted_at
      ORDER BY d.id DESC
      LIMIT ?
    `;

    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

  async getDeviceUsageStats(companyId, targetDate) {
    const query = `
      SELECT
        COUNT(*) AS total_devices,
        SUM(CASE WHEN d.is_active = 1 THEN 1 ELSE 0 END) AS online_devices,
        SUM(CASE WHEN d.is_active = 0 THEN 1 ELSE 0 END) AS offline_devices,
        SUM(CASE WHEN dac_stats.access_count > 0 THEN 1 ELSE 0 END) AS assigned_devices,
        (
          SELECT COUNT(*)
          FROM attendance_logs al
          WHERE al.company_id = ?
            AND al.device_id IS NOT NULL
            AND DATE(al.log_timestamp) = ?
        ) AS today_logs
      FROM devices d
      LEFT JOIN (
        SELECT device_id, COUNT(*) AS access_count
        FROM device_access_controls
        GROUP BY device_id
      ) dac_stats
        ON dac_stats.device_id = d.id
      WHERE d.company_id = ?
        AND d.deleted_at IS NULL
    `;

    const [rows] = await db.query(query, [companyId, targetDate, companyId]);
    const stat = rows[0] || {};

    return {
      total_devices: Number(stat.total_devices || 0),
      online_devices: Number(stat.online_devices || 0),
      offline_devices: Number(stat.offline_devices || 0),
      assigned_devices: Number(stat.assigned_devices || 0),
      today_logs: Number(stat.today_logs || 0),
      success_logs: Number(stat.today_logs || 0),
      failed_logs: 0,
    };
  }
}

module.exports = new CompanyModel();
