const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AuthModel = require("./auth.model");
const AppError = require("../../utils/AppError");

// Auth Service
class AuthService {
  // ==============================================================
  // Helper: แนบข้อมูล user_id, company_id, role ลงใน Access Token
  signAccessToken(user) {
    return jwt.sign(
      {
        user_id: user.id,
        company_id: user.company_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );
  }

  // ==============================================================
  // Helper: แนบข้อมูล user_id ลงใน Refresh Token
  signRefreshToken(userId) {
    // Refresh token contains minimal info or random string
    return jwt.sign({ user_id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    });
  }

  // ==============================================================
  // สมัครสมาชิก
  async register(data) {
    // 1. ตรวจสอบว่า email ซ้ำหรือไม่
    const existingUser = await AuthModel.findUserByEmail(data.email);
    if (existingUser) {
      throw new AppError("Email นี้ถูกใช้งานแล้ว", 400);
    }

    // 2. Hash รหัสผ่าน
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(data.password, salt);

    // 3. สร้างผู้ใช้ใหม่
    const newUserId = await AuthModel.createUser({
      ...data,
      password_hash,
    });

    return { id: newUserId, ...data };
  }

  // ==============================================================
  // เข้าสู่ระบบ
  async login(email, password) {
    // 1. ค้นหาผู้ใช้
    const user = await AuthModel.findUserByEmail(email);
    if (!user) {
      throw new AppError("ไม่พบผู้ใช้งานที่มีอีเมลนี้", 404);
    }

    // 2. ตรวจสอบรหัสผ่าน
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401);
    }

    // 3. ตรวจสอบสถานะการใช้งาน
    if (user.is_active === 0) {
      throw new AppError("บัญชีของคุณถูกระงับการใช้งาน", 403);
    }

    // 4. อัปเดตเวลาที่เข้าสู่ระบบล่าสุด
    await AuthModel.updateLastLogin(user.id);

    // 5. สร้างโทเค็น
    const accessToken = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user.id);

    // 6. บันทึก Refresh Token ลงฐานข้อมูล
    // คำนวณวันหมดอายุจาก JWT_REFRESH_EXPIRES_IN (เช่น 7 วัน)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days
    await AuthModel.createRefreshToken(user.id, refreshToken, expiresAt);

    // 7. ส่งกลับข้อมูลผู้ใช้ (ไม่รวมรหัสผ่าน)
    const { password_hash, ...userData } = user;

    return { user: userData, accessToken, refreshToken };
  }

  // ==============================================================
  // ขอ Access Token ใหม่
  async refreshToken(refreshToken) {
    // 1. ตรวจสอบโทเค็นเบื้องต้น (Verify JWT)
    try {
      jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (err) {
      console.error("เกิดข้อผิดพลาดในการตรวจสอบ refresh token:", err);
      throw new AppError("Refresh Token ไม่ถูกต้องหรือหมดอายุ", 401);
    }

    // 2. ตรวจสอบในฐานข้อมูล
    const storedToken = await AuthModel.findRefreshToken(refreshToken);
    if (!storedToken) {
      throw new AppError("Refresh Token ไม่พบในระบบ", 401);
    }

    if (storedToken.is_revoked === 1) {
      throw new AppError("Refresh Token นี้ถูกยกเลิกแล้ว", 401);
    }

    const { expires_at, user_id } = storedToken;
    if (new Date() > new Date(expires_at)) {
      throw new AppError("Refresh Token หมดอายุการใช้งาน", 401);
    }

    // 3. ตรวจสอบสถานะการใช้งานของผู้ใช้
    const user = await AuthModel.findUserById(user_id);
    if (!user || user.is_active === 0) {
      throw new AppError("User ไม่พบหรือบัญชีถูกระงับ", 403);
    }

    // 4. การหมุนเวียนโทเค็น: ยกเลิกโทเค็นเก่า
    await AuthModel.revokeRefreshToken(storedToken.id);

    // 5. สร้างโทเค็นใหม่
    const newAccessToken = this.signAccessToken(user);
    const newRefreshToken = this.signRefreshToken(user.id);

    // 6. บันทึก Refresh Token ใหม่
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);
    await AuthModel.createRefreshToken(user.id, newRefreshToken, newExpiresAt);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  // ==============================================================
  // ขอรีเซ็ตรหัสผ่าน
  async forgotPassword(email) {
    const user = await AuthModel.findUserByEmail(email);
    if (!user) {
      throw new AppError("ไม่พบผู้ใช้งานที่มีอีเมลนี้", 404);
    }
    // TODO: Generate Reset Token/Link and Send Email
    // For now, return success message or mock token
    return {
      message: "ลิงก์สำหรับรีเซ็ตรหัสผ่านถูกส่งไปยังอีเมลของคุณแล้ว (Mock)",
    };
  }

  // ==============================================================
  // ออกจากระบบ
  async logout(refreshToken) {
    if (refreshToken) {
      const storedToken = await AuthModel.findRefreshToken(refreshToken);
      if (storedToken) {
        await AuthModel.revokeRefreshToken(storedToken.id);
      }
    }
  }
}

module.exports = new AuthService();
