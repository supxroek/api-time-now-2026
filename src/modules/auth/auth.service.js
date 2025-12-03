/**
 * /src/modules/auth/auth.service.js
 *
 * Auth Service - Business Logic Layer
 * จัดการ logic ที่เกี่ยวกับการตรวจสอบสิทธิ์ผู้ใช้
 */

// import models and utilities
const authModel = require("./auth.model");
const JWT = require("./jwt");

// Service Class
class AuthService {
  // business logic for user login
  async login(email, password) {
    // ตรวจสอบผู้ใช้และรหัสผ่าน
    const user = await authModel.findUserByEmail(email);
    if (!user) {
      throw new Error("Invalid email or password");
    }
    const isPasswordValid = await authModel.verifyPassword(user, password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // สร้าง token
    const token = JWT.generateToken({ id: user.id, role: user.role });
    user.token = token;

    return user;
  }

  // บันทึกการเข้าสู่ระบบ (optional)
  async recordLogin(userId) {
    // อัปเดต last_login ในฐานข้อมูล
    await authModel.updateLastLogin(userId);
  }

  // business logic for user registration
  async register(email, password, role) {
    // ตรวจสอบว่าผู้ใช้มีอยู่แล้วหรือไม่
    const existingUser = await authModel.findUserByEmail(email);
    if (existingUser) {
      throw new Error("Email already in use");
    }
    // เพิ่มผู้ใช้ใหม่
    const newUser = await authModel.createUser(email, password, role);
    return newUser;
  }
}

module.exports = new AuthService();
