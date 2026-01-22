const jwt = require("jsonwebtoken");
const { promisify } = require("node:util");
const db = require("../config/db.config");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

/**
 * Middleware ตรวจสอบ Access Token (Stateless)
 *
 * 1. ดึง Token จาก Header Authorization
 * 2. ตรวจสอบความถูกต้องของ JWT (Verify)
 * 3. ตรวจสอบสถานะ User ในฐานข้อมูล (Security Check: is_active)
 * 4. แนบข้อมูล user_id, company_id, role ไปกับ Request
 */
const protect = catchAsync(async (req, _res, next) => {
  // 1) ตรวจสอบว่ามี Token ส่งมาหรือไม่
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("คุณไม่ได้เข้าสู่ระบบ! กรุณาเข้าสู่ระบบเพื่อเข้าถึง.", 401),
    );
  }

  // 2) ตรวจสอบความถูกต้องของ Token (Verification)
  // หาก Token หมดอายุ -> จะเกิด Error ที่ handleJWTExpiredError (ใน error.middleware.js) หรือ catch ด้านล่าง
  // ตาม Condition: "Error Handling: Manage Error case Token expired (401)"
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      // สามารถปรับ Message ให้ Client รู้ว่าต้องไป Refresh Token
      return next(new AppError("Access Token หมดอายุแล้ว", 401));
    }
    return next(new AppError("Invalid Token", 401));
  }

  const { user_id, company_id, role } = decoded;

  // 3) ตรวจสอบว่า User ยังมีตัวตนอยู่หรือไม่ และ is_active = 1 หรือไม่
  // อ้างอิงตาราง users จาก time-now-new.sql
  const [rows] = await db.query(
    "SELECT id, is_active FROM users WHERE id = ?",
    [user_id],
  );
  const currentUser = rows[0];

  if (!currentUser) {
    return next(
      new AppError(
        "User ที่เป็นเจ้าของ Token นี้ไม่มีอยู่ในระบบแล้ว (อาจถูกลบ)",
        401,
      ),
    );
  }

  // Security Check: ตรวจสอบคอลัมน์ is_active
  if (currentUser.is_active === 0) {
    return next(new AppError("บัญชีของคุณถูกระงับการใช้งาน", 403));
  }

  // 4) Multi-tenancy: แนบข้อมูล User และ Company ID ไปกับ req
  req.user = {
    id: user_id,
    company_id: company_id,
    role: role,
  };

  next();
});

/**
 * Middleware สำหรับจำกัดสิทธิ์การเข้าถึง (Role-based Authorization)
 * @param  {...any} roles - บทบาทที่อนุญาตให้เข้าถึง
 */
function restrictTo(...roles) {
  return (req, _res, next) => {
    // req.user มาจาก middleware protect
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          "คุณไม่มีสิทธิ์ในการดำเนินการนี้ (Permission Denied)",
          403,
        ),
      );
    }
    next();
  };
}

/**
 * ฟังก์ชันสำหรับตรวจสอบ Refresh Token (Stateful)
 * ใช้สำหรับ API Refresh Token (/auth/refresh-token)
 *
 * Condition:
 * - ตรวจสอบ expires_at
 * - ตรวจสอบ is_revoked ต้องเป็น 0
 * - ตรวจสอบ users.is_active
 */
async function checkRefreshToken(refreshToken) {
  // 1) Query หา Token ในตาราง refresh_tokens พร้อม User เจ้าของ
  const query = `
    SELECT rt.*, u.is_active, u.company_id, u.role
    FROM refresh_tokens rt
    JOIN users u ON rt.user_id = u.id
    WHERE rt.token = ?
  `;
  const [rows] = await db.query(query, [refreshToken]);
  const storedToken = rows[0];

  // 2) ตรวจสอบว่ามี Token หรือไม่
  if (!storedToken) {
    throw new AppError("Refresh Token ไม่ถูกต้อง หรือไม่พบในระบบ", 401);
  }

  // 3) ตรวจสอบสถานะ User (Active Check) - "Security Check: ต้องตรวจสอบ is_active"
  if (storedToken.is_active === 0) {
    throw new AppError("บัญชีของคุณถูกระงับการใช้งาน", 403);
  }

  // 4) ตรวจสอบการ Revoke
  if (storedToken.is_revoked === 1) {
    // Optional: อาจพิจารณา Revoke Token อื่นๆ ของ User นี้ด้วยหากสงสัยการถูกขโมย (Token Reuse Detection)
    throw new AppError("Refresh Token นี้ถูกยกเลิกแล้ว (Revoked)", 401);
  }

  // 5) ตรวจสอบวันหมดอายุ (Expires Check)
  if (new Date() > new Date(storedToken.expires_at)) {
    throw new AppError("Refresh Token หมดอายุแล้ว กรุณา Login ใหม่", 401);
  }

  return storedToken;
}

/**
 * ฟังก์ชันสำหรับ Refresh Token Rotation
 * - Revoke Token เก่า (is_revoked = 1)
 * - (Optional) สร้าง Token ใหม่ใน Controller
 */
async function revokeRefreshToken(tokenId) {
  await db.query("UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?", [
    tokenId,
  ]);
}

module.exports = {
  protect,
  restrictTo,
  checkRefreshToken,
  revokeRefreshToken,
};
