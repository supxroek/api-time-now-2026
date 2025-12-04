/**
 * /api/middleware/auth.middleware.js
 *
 * Authentication & Authorization Middleware
 * ตรวจสอบ JWT Token และกำหนดสิทธิ์การเข้าถึง
 */

const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * ตรวจสอบ JWT Token
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // เพิ่มข้อมูล user และ company ใน request object
    req.user = {
      id: decoded.id,
      company_id: decoded.company_id,
      role: decoded.role,
    }; // req.user สำหรับเก็บข้อมูลผู้ใช้ทั้งหมด

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "Token expired. Please login again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: "Invalid token.",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Authentication failed.",
    });
  }
};

/**
 * ตรวจสอบสิทธิ์ (Role-based)
 * @param  {...string} allowedRoles - Roles ที่อนุญาต
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(403).json({
        success: false,
        error: "Access denied. No role assigned.",
      });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};

/**
 * Mock Auth Middleware สำหรับทดสอบ (Development Only)
 * ใช้แทน authenticate เมื่อยังไม่มีระบบ login
 */
const mockAuth = (req, res, next) => {
  // ดึง company_id จาก header หรือ query parameter สำหรับทดสอบ
  const companyId =
    req.headers["x-company-id"] || req.query.company_id || req.body.company_id;

  if (!companyId) {
    return res.status(400).json({
      success: false,
      error:
        "Missing company_id. Please provide X-Company-Id header or company_id parameter.",
    });
  }

  req.companyId = Number.parseInt(companyId, 10);
  req.userId = Number.parseInt(req.headers["x-user-id"] || 1, 10);
  req.userRole = req.headers["x-user-role"] || "admin";
  req.user = {
    id: req.userId,
    companyId: req.companyId,
    role: req.userRole,
  };

  next();
};

module.exports = {
  authenticate,
  authorize,
  mockAuth,
};
