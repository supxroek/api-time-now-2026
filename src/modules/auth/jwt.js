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
}

module.exports = new JWT();
