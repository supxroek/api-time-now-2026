const db = require("../../../config/db.config");

class UserModel {
  async findAllByCompanyId(companyId, limit = 20, offset = 0, search = "") {
    let query = `
      SELECT
        u.id,
        u.company_id,
        u.employee_id,
        u.email,
        u.role,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        e.name AS employee_name,
        e.employee_code
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.company_id = ?
    `;
    const params = [companyId];

    if (search) {
      query +=
        " AND (u.email LIKE ? OR e.name LIKE ? OR e.employee_code LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += " ORDER BY u.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findByIdAndCompanyId(id, companyId) {
    const query = `
      SELECT * FROM users
      WHERE id = ? AND company_id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async countAllByCompanyId(companyId, search = "") {
    let query = `
      SELECT COUNT(*) AS total
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.company_id = ?
    `;
    const params = [companyId];

    if (search) {
      query +=
        " AND (u.email LIKE ? OR e.name LIKE ? OR e.employee_code LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  async getOverviewStats(companyId) {
    const query = `
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admin_count,
        SUM(CASE WHEN role = 'manager' THEN 1 ELSE 0 END) AS manager_count,
        SUM(CASE WHEN role = 'super_admin' THEN 1 ELSE 0 END) AS super_admin_count
      FROM users
      WHERE company_id = ?
    `;

    const [rows] = await db.query(query, [companyId]);
    return (
      rows[0] || {
        total_users: 0,
        active_users: 0,
        admin_count: 0,
        manager_count: 0,
        super_admin_count: 0,
      }
    );
  }

  async updateRole(id, companyId, data) {
    const query = `
      UPDATE users
      SET role = ?, updated_at = NOW()
      WHERE id = ? AND company_id = ?
    `;

    const [result] = await db.query(query, [data.role, id, companyId]);
    return result.affectedRows > 0;
  }

  async updateStatus(id, companyId, isActive) {
    const query = `
      UPDATE users
      SET is_active = ?, updated_at = NOW()
      WHERE id = ? AND company_id = ?
    `;

    const [result] = await db.query(query, [isActive, id, companyId]);
    return result.affectedRows > 0;
  }
}

module.exports = new UserModel();
