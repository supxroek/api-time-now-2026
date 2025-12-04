/**
 * /src/modules/auth/auth.service.js
 *
 * Auth Service - Business Logic Layer
 * จัดการ logic ที่เกี่ยวกับการตรวจสอบสิทธิ์ผู้ใช้
 */

// import models and utilities
const pool = require("../../config/database");
const authModel = require("./auth.model");
const duration = require("../../utilities/duration");
const JWT = require("./handleToken");

require("dotenv").config();
const { JWT_EXPIRES_IN = "1h" } = process.env;

// Service Class
class AuthService {
  // business logic for user login
  async login(email, password) {
    // เริ่ม transaction
    pool.beginTransaction();
    try {
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
        company_id: user.company_id,
        role: user.role,
      });
      user.token = token;
      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await pool.commit();
      return user;
    } catch (error) {
      // rollback transaction - กรณีเกิดข้อผิดพลาด: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await pool.rollback();
      await pool.release();
      throw error;
    }
  }

  // บันทึกการเข้าสู่ระบบ (optional)
  async recordLogin(userId) {
    // เริ่ม transaction
    pool.beginTransaction();
    try {
      // อัปเดต last_login ในฐานข้อมูล
      await authModel.updateLastLogin(userId);
      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await pool.commit();
    } catch (error) {
      // rollback transaction - กรณีเกิดข้อผิดพลาด: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await pool.rollback();
      await pool.release();
      throw error;
    }
  }

  // business logic for user registration
  async register(email, password, role) {
    // เริ่ม transaction
    pool.beginTransaction();
    try {
      // ตรวจสอบว่าผู้ใช้มีอยู่แล้วหรือไม่
      const existingUser = await authModel.findUserByEmail(email);
      if (existingUser) {
        throw new Error("Email already in use");
      }
      // เพิ่มผู้ใช้ใหม่
      const newUser = await authModel.createUser(email, password, role);
      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await pool.commit();
      return newUser;
    } catch (error) {
      // rollback transaction - กรณีเกิดข้อผิดพลาด: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await pool.rollback();
      await pool.release();
      throw error;
    }
  }

  // business logic for refreshing token
  async refreshToken(oldToken) {
    // เริ่ม transaction
    await pool.beginTransaction();
    try {
      // ตรวจสอบและสร้าง token ใหม่
      const payload = JWT.verifyToken(oldToken);
      if (!payload) {
        throw new Error("Invalid token");
      }
      // สร้าง token ใหม่
      const newToken = JWT.generateToken({
        id: payload.id,
        company_id: payload.company_id,
        role: payload.role,
      });
      // คำนวณวันหมดอายุของ token ใหม่
      const ms = await duration.parseDurationToMs(JWT_EXPIRES_IN);
      const expiresAt = new Date(Date.now() + ms);
      // บันทึก refresh token ใหม่ในฐานข้อมูล
      await authModel.updateRefreshToken(payload.id, newToken, expiresAt);
      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await pool.commit();
      return newToken;
    } catch (error) {
      // rollback transaction - กรณีเกิดข้อผิดพลาด: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await pool.rollback();
      await pool.release();
      throw error;
    }
  }
}

module.exports = new AuthService();
