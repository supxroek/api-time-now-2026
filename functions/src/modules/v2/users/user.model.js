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
