const db = require("../../config/db.config");

// Auth Model
class AuthModel {
  // ==============================================================
  // สร้างผู้ใช้ใหม่
  async createUser(userData) {
    const { company_id, employee_id, email, password_hash, role } = userData;
    const query = `
      INSERT INTO users (company_id, employee_id, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `;
    const [result] = await db.query(query, [
      company_id,
      employee_id,
      email,
      password_hash,
      role || "admin",
    ]);
    return result.insertId;
  }

  // ==============================================================
  // ค้นหาผู้ใช้ตามอีเมล
  async findUserByEmail(email) {
    const query = `
      SELECT u.*, e.name, e.employee_code 
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.email = ?
    `;
    const [rows] = await db.execute(query, [email]);
    return rows[0];
  }

  // ==============================================================
  // ค้นหาผู้ใช้ตาม ID
  async findUserById(id) {
    const query = `SELECT * FROM users WHERE id = ?`;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตเวลาการเข้าสู่ระบบล่าสุด
  async updateLastLogin(userId) {
    const query = `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`;
    await db.query(query, [userId]);
  }

  // ==============================================================
  // สร้าง Refresh Token ใหม่
  async createRefreshToken(userId, token, expiresAt) {
    const query = `
      INSERT INTO refresh_tokens (user_id, token, expires_at, is_revoked)
      VALUES (?, ?, ?, 0)
    `;
    await db.query(query, [userId, token, expiresAt]);
  }

  // ==============================================================
  // ค้นหา Refresh Token
  async findRefreshToken(token) {
    const query = `SELECT * FROM refresh_tokens WHERE token = ?`;
    const [rows] = await db.query(query, [token]);
    return rows[0];
  }

  // ==============================================================
  // ยกเลิก Refresh Token
  async revokeRefreshToken(id) {
    const query = `UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?`;
    await db.query(query, [id]);
  }

  // ==============================================================
  // ยกเลิก Refresh Token ทั้งหมดของผู้ใช้
  async revokeAllUserRefreshTokens(userId) {
    const query = `UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?`;
    await db.query(query, [userId]);
  }
}

module.exports = new AuthModel();
