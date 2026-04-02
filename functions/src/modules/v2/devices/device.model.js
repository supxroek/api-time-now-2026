const db = require("../../../config/db.config");

class DeviceModel {
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
        (
          SELECT COUNT(*)
          FROM device_access_controls dac
          WHERE dac.device_id = d.id
        ) AS access_control_count
      FROM devices d
      WHERE d.company_id = ?
        AND d.deleted_at IS NULL
      ORDER BY d.id DESC
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
        d.head_employee_id
      FROM departments d
      WHERE d.company_id = ?
      ORDER BY d.department_name ASC, d.id ASC
      LIMIT ?
    `;

    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

  async listEmployeesForOverview(companyId, limit = 2000) {
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

  async getTodayDeviceActivity(companyId, targetDate) {
    const query = `
      SELECT
        COUNT(*) AS today_logs
      FROM attendance_logs al
      WHERE al.company_id = ?
        AND al.device_id IS NOT NULL
        AND DATE(al.log_timestamp) = ?
    `;

    const [rows] = await db.query(query, [companyId, targetDate]);
    const stat = rows[0] || {};

    return {
      today: Number(stat.today_logs || 0),
      success: Number(stat.today_logs || 0),
      failed: 0,
    };
  }

  async create(data) {
    const keys = Object.keys(data);
    const values = keys.map((key) => data[key]);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `
      INSERT INTO devices (${keys.join(", ")})
      VALUES (${placeholders})
    `;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  async findAllByCompanyId(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `
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
        (
          SELECT COUNT(*)
          FROM device_access_controls dac
          WHERE dac.device_id = d.id
        ) AS access_control_count
      FROM devices d
      WHERE d.company_id = ?
        AND d.deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.search) {
      query +=
        " AND (d.name LIKE ? OR d.hwid LIKE ? OR d.location_name LIKE ?)";
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    if (filters.is_active !== undefined && filters.is_active !== "") {
      query += " AND d.is_active = ?";
      params.push(Number(filters.is_active));
    }

    query += " ORDER BY d.id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async countAllByCompanyId(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) AS total
      FROM devices d
      WHERE d.company_id = ?
        AND d.deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.search) {
      query +=
        " AND (d.name LIKE ? OR d.hwid LIKE ? OR d.location_name LIKE ?)";
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    if (filters.is_active !== undefined && filters.is_active !== "") {
      query += " AND d.is_active = ?";
      params.push(Number(filters.is_active));
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  async findByIdAndCompanyId(deviceId, companyId) {
    const query = `
      SELECT
        id,
        company_id,
        name,
        location_name,
        description,
        hwid,
        passcode,
        is_active,
        deleted_at
      FROM devices
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;

    const [rows] = await db.query(query, [deviceId, companyId]);
    return rows[0] || null;
  }

  async findByHwid(hwid, excludeDeviceId = null) {
    let query = `
      SELECT id, company_id, hwid
      FROM devices
      WHERE hwid = ? AND deleted_at IS NULL
    `;
    const params = [hwid];

    if (excludeDeviceId) {
      query += " AND id <> ?";
      params.push(excludeDeviceId);
    }

    query += " LIMIT 1";
    const [rows] = await db.query(query, params);
    return rows[0] || null;
  }

  async updateByIdAndCompanyId(deviceId, companyId, data) {
    const keys = Object.keys(data);
    if (!keys.length) {
      return;
    }

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => data[key]);

    const query = `
      UPDATE devices
      SET ${setClause}
      WHERE id = ? AND company_id = ?
    `;

    await db.query(query, [...values, deviceId, companyId]);
  }

  async softDeleteByIdAndCompanyId(deviceId, companyId) {
    const query = `
      UPDATE devices
      SET deleted_at = CURRENT_TIMESTAMP, is_active = 0
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [deviceId, companyId]);
  }

  async getAccessControlsByDeviceId(deviceId) {
    const query = `
      SELECT
        dac.id,
        dac.device_id,
        dac.target_type,
        dac.target_id,
        e.name AS employee_name,
        d.department_name
      FROM device_access_controls dac
      LEFT JOIN employees e
        ON dac.target_type = 'employee'
       AND dac.target_id = e.id
      LEFT JOIN departments d
        ON dac.target_type = 'department'
       AND dac.target_id = d.id
      WHERE dac.device_id = ?
      ORDER BY dac.id DESC
    `;

    const [rows] = await db.query(query, [deviceId]);
    return rows;
  }

  async findAccessControl(deviceId, targetType, targetId) {
    let query = `
      SELECT id, device_id, target_type, target_id
      FROM device_access_controls
      WHERE device_id = ?
        AND target_type = ?
    `;
    const params = [deviceId, targetType];

    if (targetId === null) {
      query += " AND target_id IS NULL";
    } else {
      query += " AND target_id = ?";
      params.push(targetId);
    }

    query += " LIMIT 1";
    const [rows] = await db.query(query, params);
    return rows[0] || null;
  }

  async createAccessControl(deviceId, targetType, targetId) {
    const query = `
      INSERT INTO device_access_controls (device_id, target_type, target_id)
      VALUES (?, ?, ?)
    `;
    const [result] = await db.query(query, [deviceId, targetType, targetId]);
    return result.insertId;
  }

  async deleteAccessControl(accessControlId, deviceId) {
    const query = `
      DELETE FROM device_access_controls
      WHERE id = ? AND device_id = ?
    `;
    await db.query(query, [accessControlId, deviceId]);
  }

  async existsEmployeeInCompany(employeeId, companyId) {
    const query = `
      SELECT id
      FROM employees
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;
    const [rows] = await db.query(query, [employeeId, companyId]);
    return rows.length > 0;
  }

  async existsDepartmentInCompany(departmentId, companyId) {
    const query = `
      SELECT id
      FROM departments
      WHERE id = ? AND company_id = ?
      LIMIT 1
    `;
    const [rows] = await db.query(query, [departmentId, companyId]);
    return rows.length > 0;
  }
}

module.exports = new DeviceModel();
