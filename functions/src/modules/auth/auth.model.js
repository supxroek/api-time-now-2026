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

  // ค้นหาผู้ใช้ตาม id
  async findUserById(id) {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [id]
    );
    return rows[0] || null;
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
    // ลบ refresh token เดิมทั้งหมดของผู้ใช้ (single active token policy)
    await pool.query("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);

    // บันทึก refresh token ใหม่ในฐานข้อมูล
    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [userId, refreshToken, expiresAt]
    );
  }

  // ค้นหา refresh token โดยค่า token
  async findRefreshToken(token) {
    const [rows] = await pool.query(
      "SELECT * FROM refresh_tokens WHERE token = ? LIMIT 1",
      [token]
    );
    return rows[0] || null;
  }

  // ลบ refresh tokens ทั้งหมดของผู้ใช้ (revoke)
  async deleteRefreshTokensByUser(userId) {
    await pool.query("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);
  }
}

module.exports = new AuthModel();
