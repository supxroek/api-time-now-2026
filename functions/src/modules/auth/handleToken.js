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
  generateToken(payload, expiresIn) {
    const opts = expiresIn ? { expiresIn } : { expiresIn: JWT_EXPIRES_IN };
    return jwt.sign(payload, JWT_SECRET, opts);
  }

  // ตรวจสอบและถอดรหัส JWT token
  verifyToken(token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { valid: true, payload };
    } catch (error) {
      console.error("JWT verification failed:", error);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new JWT();
