const db = require("../../config/db.config");

// User Model
class UserModel {
  // ==============================================================
  // ดึงรายชื่อผู้ใช้ทั้งหมดของบริษัท
  async findAll(companyId) {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.role,
        u.is_active,
        u.last_login,
        u.created_at,
        u.employee_id,
        e.name AS employee_name,
        e.employee_code,
        e.image_url AS employee_avatar
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.company_id = ?
      ORDER BY u.created_at ASC
    `;
    const [rows] = await db.query(query, [companyId]);
    return rows;
  }

  // ==============================================================
  // ดึงผู้ใช้ตาม ID (ภายในบริษัทเดียวกัน)
  async findById(companyId, userId) {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.role,
        u.is_active,
        u.last_login,
        u.created_at,
        u.employee_id,
        e.name AS employee_name,
        e.employee_code,
        e.image_url AS employee_avatar
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.id = ? AND u.company_id = ?
    `;
    const [rows] = await db.query(query, [userId, companyId]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตบทบาทผู้ใช้
  async updateRole(companyId, userId, role) {
    const query = `
      UPDATE users SET role = ? WHERE id = ? AND company_id = ?
    `;
    const [result] = await db.query(query, [role, userId, companyId]);
    return result.affectedRows > 0;
  }

  // ==============================================================
  // เปลี่ยนสถานะผู้ใช้ (active/suspended)
  async toggleActive(companyId, userId, isActive) {
    const query = `
      UPDATE users SET is_active = ? WHERE id = ? AND company_id = ?
    `;
    const [result] = await db.query(query, [isActive, userId, companyId]);
    return result.affectedRows > 0;
  }

  // ==============================================================
  // ดึงสถิติผู้ใช้ของบริษัท
  async getStats(companyId) {
    const query = `
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users,
        SUM(CASE WHEN role = 'admin' OR role = 'super_admin' THEN 1 ELSE 0 END) AS admin_count,
        SUM(CASE WHEN role = 'manager' THEN 1 ELSE 0 END) AS manager_count
      FROM users
      WHERE company_id = ?
    `;
    const [rows] = await db.query(query, [companyId]);
    return rows[0];
  }
}

module.exports = new UserModel();
