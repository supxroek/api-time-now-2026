/**
 * /src/modules/auth/auth.controller.js
 *
 * Auth Controller
 * จัดการ request/response สำหรับ Auth endpoints
 */

// import services and helpers
const authService = require("./auth.service");

// Controller Class
class AuthController {
  // POST /api/auth/login
  async login(req, res) {
    console.log("Login body:", req.body);
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Raw body:", req.rawBody ? req.rawBody.toString() : "No raw body");
    try {
      const { email, password } = req.body;
      const user = await authService.login(email, password);

      // บันทึกการเข้าสู่ระบบ (optional)
      await authService.recordLogin(user.id);

      // กรองข้อมูลที่จะส่งกลับไปยัง client
      const { password_hash, ...result } = user; // ลบ password_hash ออก
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
      const { token } = req.body;
      const newToken = await authService.refreshToken(token);
      res.json({
        success: true,
        data: { token: newToken },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new AuthController();
