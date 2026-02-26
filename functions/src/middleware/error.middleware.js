const AppError = require("../utils/AppError");

// ข้อผิดพลาดจากการแปลงประเภทข้อมูลในฐานข้อมูล
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// ข้อผิดพลาดจากฐานข้อมูลที่ซ้ำกัน
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `ค่า field ซ้ำ: ${value}. กรุณาใช้ค่าอื่น!`;
  return new AppError(message, 400);
};

// ข้อผิดพลาดจากการตรวจสอบข้อมูลในฐานข้อมูล
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((val) => val.message);
  const message = `ข้อมูล input ไม่ถูกต้อง. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

// ข้อผิดพลาดจากโทเค็นที่ไม่ถูกต้อง
const handleJWTError = () =>
  new AppError("โทเค็นไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง!", 401);

// ข้อผิดพลาดจากโทเค็นที่หมดอายุ
const handleJWTExpiredError = () =>
  new AppError("โทเค็นของคุณหมดอายุแล้ว! กรุณาเข้าสู่ระบบใหม่อีกครั้ง.", 401);

const sendErrorDev = (err, res) => {
  console.error("ERROR 💥", err); // Log error to console in development
  if (err.originalError?.response?.data) {
    console.error(
      "LINE API Error Details:",
      JSON.stringify(err.originalError.response.data, null, 2),
    );
  }
  res.status(err.statusCode).json({
    status: "error",
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message,
      details: err.details || {},
    },
    message: err.message,
    raw_error: err,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // ข้อผิดพลาดที่คาดการณ์ได้ : ส่งข้อความข้อผิดพลาดไปยังไคลเอนต์
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: "error",
      error: {
        code: err.code || "INTERNAL_ERROR",
        message: err.message,
        details: err.details || {},
      },
      message: err.message,
    });
  } else {
    // ข้อผิดพลาดที่ไม่คาดคิด : ไม่เปิดเผยรายละเอียดข้อผิดพลาด
    console.error("ERROR 💥", err);

    res.status(500).json({
      status: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: "เกิดข้อผิดพลาดบางอย่าง!",
        details: {},
      },
      message: "เกิดข้อผิดพลาดบางอย่าง!",
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    if (err.name === "CastError") error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === "ValidationError") error = handleValidationErrorDB(error);
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
