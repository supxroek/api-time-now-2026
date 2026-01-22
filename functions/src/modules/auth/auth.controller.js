/**
 * /src/modules/auth/auth.controller.js
 *
 * Auth Controller
 * จัดการ request/response สำหรับ Auth endpoints
 */

// import services and helpers
const authService = require("./auth.service");
require("dotenv").config();

// อ่านค่าตัวแปรสภาพแวดล้อมที่เกี่ยวข้องกับ cookie
// (Firebase Hosting requires `__session` in some setups)
const { NODE_ENV = "production", COOKIE_NAME = "__session" } = process.env;

// Helper สำหรับสร้าง Cookie Options เพื่อใช้ร่วมกันในหลายจุด
// Development: sameSite=lax, secure=false (localhost ใช้ HTTP)
// Production: sameSite=none, secure=true (Cross-origin ต้องใช้ HTTPS)
const getCookieOptions = (expiresAt = null) => {
  const isDev = NODE_ENV !== "production";

  const options = {
    httpOnly: true,
    secure: !isDev, // Dev: false (HTTP), Prod: true (HTTPS)
    sameSite: isDev ? "lax" : "none", // Dev: lax, Prod: none (cross-origin)
    path: "/",
    // กำหนด maxAge เป็น fallback (7 วัน)
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  if (expiresAt) {
    options.expires = new Date(expiresAt);
    delete options.maxAge; // ใช้ expires แทนถ้ามีค่าที่ชัดเจนจาก DB
  }

  return options;
};

// Controller Class
class AuthController {
  // POST /api/auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = await authService.login(email, password);

      // บันทึกการเข้าสู่ระบบ (optional)
      await authService.recordLogin(user.id);

      // ตั้งค่า refresh token เป็น httpOnly cookie
      const refreshToken = user.refreshToken;
      // คำนวณ options สำหรับ cookie
      const cookieOptions = getCookieOptions(user.refreshTokenExpiresAt);
      res.cookie(COOKIE_NAME, refreshToken, cookieOptions);

      // กรองข้อมูลที่จะส่งกลับไปยัง client (ไม่ส่ง refreshToken กลับใน body)
      const { password_hash, refreshTokenExpiresAt, ...result } = user; // ลบ sensitive fields
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Login error:", error); // Log the full error
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  // POST /api/auth/register
  async register(req, res) {
    try {
      const { email, password, role } = req.body;
      const result = await authService.register(email, password, role);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  // POST /api/auth/refresh-token
  async refreshToken(req, res) {
    try {
      // Prefer cookie-based refresh token (httpOnly)
      const refreshTokenFromCookie = req.cookies?.[COOKIE_NAME];
      const refreshToken = req.body?.refreshToken || refreshTokenFromCookie;

      if (!refreshToken) {
        console.error(
          "[RefreshToken] Missing token. Cookies keys:",
          Object.keys(req.cookies || {})
        );
        throw new Error("Refresh token is missing");
      }

      const tokens = await authService.refreshToken(refreshToken);
      // tokens: { accessToken, refreshToken }
      // Set new refresh token in httpOnly cookie (rotation)
      const cookieOptions = getCookieOptions();
      res.cookie(COOKIE_NAME, tokens.refreshToken, cookieOptions);
      res.json({
        success: true,
        data: {
          token: tokens.accessToken,
        },
      });
    } catch (error) {
      console.error("Refresh Token Error:", error.message);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  // POST /api/auth/logout
  async logout(req, res) {
    try {
      // try to obtain userId from body or Authorization header
      let userId = req.body?.userId;
      if (!userId) {
        const authHeader =
          req.headers["authorization"] || req.headers["Authorization"];
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.split(" ")[1];
          const verifyResult = require("./handleToken").verifyToken(token);
          if (verifyResult?.valid && verifyResult.payload?.id)
            userId = verifyResult.payload.id;
        }
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "Missing userId or Authorization token",
        });
      }

      // call service to revoke refresh tokens
      await authService.logout(userId);
      // clear cookie on logout
      res.clearCookie(COOKIE_NAME);

      return res.json({ success: true, data: { revoked: true } });
    } catch (error) {
      console.error("Logout error:", error);
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new AuthController();
