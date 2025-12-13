/**
 * /src/modules/auth/auth.service.js
 *
 * Auth Service - Business Logic Layer
 * จัดการ logic ที่เกี่ยวกับการตรวจสอบสิทธิ์ผู้ใช้
 */

// import models and utilities
const pool = require("../../config/database");
const authModel = require("./auth.model");
const DateUtil = require("../../utilities/date");
const JWT = require("./handleToken");

require("dotenv").config();
const { JWT_EXPIRES_IN = "1h" } = process.env;

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
    const token = JWT.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      employee_id: user.employee_id,
      company_id: user.company_id,
      is_active: user.is_active,
    });
    user.token = token;

    return user;
  }

  // บันทึกการเข้าสู่ระบบ (optional)
  async recordLogin(userId) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // อัปเดต last_login ในฐานข้อมูล
      await authModel.updateLastLogin(userId);
      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      connection.release();
    } catch (error) {
      // rollback transaction - กรณีเกิดข้อผิดพลาด: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  // business logic for user registration
  async register(email, password, role) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบว่าผู้ใช้มีอยู่แล้วหรือไม่
      const existingUser = await authModel.findUserByEmail(email);
      if (existingUser) {
        throw new Error("Email already in use");
      }
      // เพิ่มผู้ใช้ใหม่
      const newUser = await authModel.createUser(email, password, role);
      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      connection.release();
      return newUser;
    } catch (error) {
      // rollback transaction - กรณีเกิดข้อผิดพลาด: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  // business logic for refreshing token
  async refreshToken(oldToken) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบและสร้าง token ใหม่
      const payload = JWT.verifyToken(oldToken);
      if (!payload) {
        throw new Error("Invalid token");
      }
      // สร้าง token ใหม่
      const newToken = JWT.generateToken({
        id: payload.id,
        email: payload.email,
        role: payload.role,
        employee_id: payload.employee_id,
        company_id: payload.company_id,
        is_active: payload.is_active,
      });
      // คำนวณวันหมดอายุของ token ใหม่
      const expiresAt = DateUtil.getExpirationDate(JWT_EXPIRES_IN);
      // บันทึก refresh token ใหม่ในฐานข้อมูล
      await authModel.updateRefreshToken(payload.id, newToken, expiresAt);
      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      connection.release();
      return newToken;
    } catch (error) {
      // rollback transaction - กรณีเกิดข้อผิดพลาด: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }
}

module.exports = new AuthService();
