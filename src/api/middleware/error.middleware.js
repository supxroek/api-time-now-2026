/**
 * /api/middleware/error.middleware.js
 *
 * Error Handling Middleware
 * จัดการ Error ทั้งหมดในระบบ
 */

const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  console.error("Error:", {
    message: err.message,
    stack: NODE_ENV === "development" ? err.stack : undefined,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
  });

  // กำหนด status code
  const statusCode = err.statusCode || 500;

  // สร้าง response
  const response = {
    success: false,
    error: err.message || "Internal Server Error",
  };

  // เพิ่มข้อมูลเพิ่มเติมใน development mode
  if (NODE_ENV === "development") {
    response.stack = err.stack;
    response.details = err.details;
  }

  // เพิ่ม field อื่นๆ ถ้ามี
  if (err.employeeCount !== undefined) {
    response.employeeCount = err.employeeCount;
  }

  res.status(statusCode).json(response);
};

/**
 * Not Found Handler (404)
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found",
    path: req.path,
    method: req.method,
  });
};

/**
 * Async Handler Wrapper
 * ครอบ async function เพื่อ catch error อัตโนมัติ
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
