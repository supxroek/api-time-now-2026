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
const { JWT_REFRESH_EXPIRES_IN = "7d" } = process.env;

// Service Class
class AuthService {
  // business logic for user login
  async login(email, password) {
    // ตรวจสอบผู้ใช้และรหัสผ่าน
    const user = await authModel.findUserByEmail(email);
    if (!user) {
      throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    const isPasswordValid = await authModel.verifyPassword(user, password);
    if (!isPasswordValid) {
      throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    // สร้าง access token
    const accessToken = JWT.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      is_active: user.is_active,
    });

    // สร้าง refresh token (ระยะเวลายาวกว่า)
    const refreshExpires = JWT_REFRESH_EXPIRES_IN;
    const refreshToken = JWT.generateToken(
      {
        id: user.id,
        email: user.email,
      },
      refreshExpires
    );

    // บันทึก refresh token ลงฐานข้อมูล
    const expiresAt = DateUtil.getExpirationDate(refreshExpires);
    await authModel.updateRefreshToken(user.id, refreshToken, expiresAt);

    // คืนค่าข้อมูลผู้ใช้พร้อม tokens
    user.token = accessToken;
    user.refreshToken = refreshToken;
    user.refreshTokenExpiresAt = expiresAt;

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
        throw new Error("อีเมลนี้ถูกใช้งานแล้ว");
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
      // ตรวจสอบ refresh token และสร้าง access + refresh token ใหม่
      // ตรวจสอบว่ามี refresh token นี้ในฐานข้อมูลและยังไม่หมดอายุ
      const tokenRow = await authModel.findRefreshToken(oldToken);
      if (!tokenRow) {
        // การนำ refresh token ที่ไม่ถูกต้องมาใช้ซ้ำ (reuse attack) ควรเพิกถอน token ทั้งหมดของผู้ใช้
        // ตรวจสอบว่า token นี้เคยถูกใช้มาก่อนหรือไม่
        const verifyResultForReuse = JWT.verifyToken(oldToken);
        if (
          verifyResultForReuse &&
          verifyResultForReuse.valid &&
          verifyResultForReuse.payload?.id
        ) {
          // ยกเลิก refresh tokens ทั้งหมดของผู้ใช้
          await authModel.deleteRefreshTokensByUser(
            verifyResultForReuse.payload.id
          );
          throw new Error(
            "ตรวจพบการนำโทเค็นรีเฟรชมาใช้ซ้ำ โทเค็นทั้งหมดถูกเพิกถอนแล้ว"
          );
        }

        throw new Error("Refresh token ไม่ถูกต้องหรือถูกเพิกถอน");
      }

      // ตรวจสอบ expiry
      const now = new Date();
      if (tokenRow.expires_at && new Date(tokenRow.expires_at) < now) {
        // ลบ token ที่หมดอายุแล้ว (cleanup)
        await authModel.deleteRefreshTokensByUser(tokenRow.user_id);
        throw new Error("Refresh token หมดอายุ");
      }

      // ตรวจสอบความถูกต้องของ signature/payload
      const verifyResult = JWT.verifyToken(oldToken);
      if (!verifyResult?.valid) {
        throw new Error("Refresh token ไม่ถูกต้องหรือหมดอายุ");
      }
      const payload = verifyResult.payload;

      // โหลดข้อมูลผู้ใช้ปัจจุบันจากฐานข้อมูลเพื่อประกอบ claims ใหม่ (ใช้ user จาก DB เพื่อให้ข้อมูลล่าสุด)
      const user = await authModel.findUserById(payload.id || tokenRow.user_id);
      if (!user) {
        throw new Error("ไม่พบผู้ใช้ที่เกี่ยวข้องกับ Refresh token");
      }

      // สร้าง access token ใหม่ โดยใช้ข้อมูลล่าสุดจาก DB
      const newAccessToken = JWT.generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        is_active: user.is_active,
      });

      // สร้าง refresh token ใหม่
      const refreshExpires = JWT_REFRESH_EXPIRES_IN;
      const newRefreshToken = JWT.generateToken(
        { id: user.id, email: user.email },
        refreshExpires
      );

      // คำนวณวันหมดอายุของ refresh token ใหม่
      const expiresAt = DateUtil.getExpirationDate(refreshExpires);
      // บันทึก refresh token ใหม่ในฐานข้อมูล
      await authModel.updateRefreshToken(user.id, newRefreshToken, expiresAt);

      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      connection.release();

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      // rollback transaction - กรณีเกิดข้อผิดพลาด: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  // revoke refresh tokens for a given user (logout)
  async logout(userId) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      await authModel.deleteRefreshTokensByUser(userId);
      await connection.commit();
      connection.release();
      return true;
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  }
}

module.exports = new AuthService();
