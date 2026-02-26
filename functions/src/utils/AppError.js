// คลาสสำหรับจัดการข้อผิดพลาดในแอปพลิเคชัน (Custom Application Error Class)
class AppError extends Error {
  constructor(message, statusCode, code = "INTERNAL_ERROR", details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
