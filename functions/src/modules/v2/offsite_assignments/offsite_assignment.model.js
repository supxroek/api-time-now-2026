const db = require("../../../config/db.config");

const TABLE = "offsite_assignments";

class OffsiteAssignmentModel {
  /**
   * Overview: ดึงรายการทั้งหมดของบริษัท พร้อม JOIN ชื่อพนักงาน
   */
  async listForOverview(companyId, limit = 500) {
    const query = `
      SELECT
        oa.id,
        oa.employee_id,
        oa.company_id,
        oa.target_date,
        oa.location_url,
        oa.latitude,
        oa.longitude,
        oa.radius_meters,
        oa.is_active,
        oa.created_at,
        e.name AS employee_name,
        e.employee_code,
        d.department_name
      FROM ${TABLE} oa
      LEFT JOIN employees e
        ON e.id = oa.employee_id AND e.company_id = oa.company_id
      LEFT JOIN departments d
        ON d.id = e.department_id AND d.company_id = e.company_id
      WHERE oa.company_id = ?
      ORDER BY oa.target_date DESC, oa.id DESC
      LIMIT ?
    `;
    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

  /**
   * ดึง employees สำหรับ dropdown
   */
  async listEmployeesForDropdown(companyId, limit = 2000) {
    const query = `
      SELECT
        e.id,
        e.employee_code,
        e.name,
        d.department_name
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id AND d.company_id = e.company_id
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
      ORDER BY e.name ASC
      LIMIT ?
    `;
    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

  /**
   * หาตาม ID + company_id
   */
  async findByIdAndCompanyId(id, companyId) {
    const query = `
      SELECT
        oa.id,
        oa.employee_id,
        oa.company_id,
        oa.target_date,
        oa.location_url,
        oa.latitude,
        oa.longitude,
        oa.radius_meters,
        oa.is_active,
        oa.created_at,
        e.name AS employee_name,
        e.employee_code
      FROM ${TABLE} oa
      LEFT JOIN employees e
        ON e.id = oa.employee_id AND e.company_id = oa.company_id
      WHERE oa.id = ?
        AND oa.company_id = ?
    `;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  /**
   * ตรวจ duplicate: พนักงาน + วันที่ + active
   */
  async findDuplicate(employeeId, targetDate, excludeId = null) {
    let query = `
      SELECT id FROM ${TABLE}
      WHERE employee_id = ?
        AND target_date = ?
        AND is_active = 1
    `;
    const params = [employeeId, targetDate];

    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }

    const [rows] = await db.query(query, params);
    return rows[0] || null;
  }

  /**
   * สร้างรายการใหม่
   */
  async create(data) {
    const query = `
      INSERT INTO ${TABLE}
        (employee_id, company_id, target_date, location_url, latitude, longitude, radius_meters, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.employee_id,
      data.company_id,
      data.target_date,
      data.location_url,
      data.latitude || null,
      data.longitude || null,
      data.radius_meters || 200,
      data.is_active === undefined ? 1 : Number(data.is_active),
    ];
    const [result] = await db.query(query, params);
    return result.insertId;
  }

  /**
   * อัปเดตตาม ID + company_id
   */
  async updateByIdAndCompanyId(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => data[k]);

    const query = `
      UPDATE ${TABLE}
      SET ${setClause}
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [...values, id, companyId]);
  }

  /**
   * ลบ (deactivate) ตาม ID + company_id
   */
  async deactivateByIdAndCompanyId(id, companyId) {
    const query = `
      UPDATE ${TABLE}
      SET is_active = 0
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [id, companyId]);
  }

  /**
   * นับสถิติ
   */
  async getStats(companyId) {
    const query = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive,
        SUM(CASE WHEN is_active = 1 AND target_date = CURDATE() THEN 1 ELSE 0 END) AS today
      FROM ${TABLE}
      WHERE company_id = ?
    `;
    const [rows] = await db.query(query, [companyId]);
    return rows[0] || { total: 0, active: 0, inactive: 0, today: 0 };
  }
}

module.exports = new OffsiteAssignmentModel();
