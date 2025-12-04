const pool = require("../../config/database");
const bcrypt = require("bcrypt");

// Model Class
class AuthModel {
  // ค้นหาผู้ใช้ตามอีเมล
  async findUserByEmail(email) {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return rows[0];
  }

  // ตรวจสอบรหัสผ่าน
  async verifyPassword(user, password) {
    // ตรวจสอบด้วย bcrypt
    return await bcrypt.compare(password, user.password_hash);
  }

  // อัปเดต last_login
  async updateLastLogin(userId) {
    await pool.query("UPDATE users SET last_login = NOW() WHERE id = ?", [
      userId,
    ]);
  }

  // สร้างผู้ใช้ใหม่
  async createUser(email, password, role) {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
      [email, passwordHash, role]
    );
    return { id: result.insertId, email, role };
  }

  // อัปเดต refresh token
  async updateRefreshToken(userId, refreshToken, expiresAt) {
    // บันทึก refresh token ในฐานข้อมูล
    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [userId, refreshToken, expiresAt]
    );
  }
}

module.exports = new AuthModel();
