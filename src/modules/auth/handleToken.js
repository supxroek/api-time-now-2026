/**
 * /src/mudules/auth/jwt.js
 *
 * JSON Web Token (JWT) authentication module.
 * จัดการการสร้าง Token
 */

const jwt = require("jsonwebtoken");
require("dotenv").config();

// โหลดค่าคอนฟิกจาก environment variables
const { JWT_SECRET, JWT_EXPIRES_IN = "1h" } = process.env;

//  JWT Class
class JWT {
  // สร้าง JWT token
  generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  // ตรวจสอบและถอดรหัส JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      console.error("JWT verification failed:", error);
      return null; // ถ้า token ไม่ถูกต้อง ให้คืนค่า null
    }
  }
}

module.exports = new JWT();
