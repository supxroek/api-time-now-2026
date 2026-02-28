const db = require("../../../config/db.config");

class AuthModel {
  async findUserByEmail(email) {
    const query = `
      SELECT
        u.id,
        u.company_id,
        u.employee_id,
        u.email,
        u.password_hash,
        u.role,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        e.name AS employee_name,
        e.employee_code,
        e.image_url AS employee_avatar
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.email = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [email]);
    return rows[0] || null;
  }

  async findUserById(userId) {
    const query = `
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
        e.employee_code,
        e.image_url AS employee_avatar
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [userId]);
    return rows[0] || null;
  }

  async updateLastLogin(userId) {
    const query = `
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.query(query, [userId]);
  }

  async createRefreshToken(userId, token, expiresAt) {
    const query = `
      INSERT INTO refresh_tokens (user_id, token, expires_at, is_revoked)
      VALUES (?, ?, ?, 0)
    `;

    await db.query(query, [userId, token, expiresAt]);
  }

  async findRefreshToken(token) {
    const query = `
      SELECT
        rt.id,
        rt.user_id,
        rt.token,
        rt.expires_at,
        rt.is_revoked,
        u.company_id,
        u.role,
        u.is_active
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [token]);
    return rows[0] || null;
  }

  async revokeRefreshToken(tokenId) {
    const query = `
      UPDATE refresh_tokens
      SET is_revoked = 1
      WHERE id = ?
    `;

    await db.query(query, [tokenId]);
  }
}

module.exports = new AuthModel();
