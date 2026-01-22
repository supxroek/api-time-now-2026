const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const cookieParser = require("cookie-parser");

// โหลด environment variables จากไฟล์ .env
require("dotenv").config();

const errorMiddleware = require("./src/middleware/error.middleware");
const AppError = require("./src/utils/AppError");

// กำหนด Region เป็น asia-southeast1
setGlobalOptions({ region: "asia-southeast1" });

// สร้าง app Express
const app = express();

// กำหนดพอร์ตจาก environment variable หรือใช้ค่าเริ่มต้น 3000
const {
  NODE_ENV = "development",
  PORT = 3000,
  CORS_ORIGIN = "*",
  BODY_LIMIT = "10mb",
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX = 100,
  TRUST_PROXY = "true",
} = process.env;

// รวมการตั้งค่าสำหรับ Development และ Production ทั้งหมดไว้ตรงนี้
const isProduction = NODE_ENV === "production";
const config = {
  env: NODE_ENV,
  port: Number(PORT),
  isProduction,
  corsOrigin: CORS_ORIGIN,
  bodyLimit: BODY_LIMIT,
  trustProxy:
    (TRUST_PROXY && String(TRUST_PROXY).toLowerCase() === "true") ||
    isProduction
      ? 1
      : 0,
  rateLimit: {
    windowMs: Number(RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: Number(RATE_LIMIT_MAX),
    standardHeaders: true,
    legacyHeaders: false,
    message: "คำขอมากเกินไป โปรดลองใหม่ในภายหลัง",
  },
};

// Create winston logger
const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple(),
  ),
  transports: [new winston.transports.Console()],
});

// ตั้งค่า trust proxy (ใช้เมื่อทำงานหลัง proxy หรือเมื่อรัน production)
if (config.trustProxy) {
  app.set("trust proxy", config.trustProxy);
}

// กำหนดค่า CORS (อ้างอิงค่าจาก config กลาง)
config.corsOrigin =
  config.corsOrigin === "*"
    ? { origin: true }
    : { origin: config.corsOrigin.split(",").map((s) => s.trim()) };

// ตั้งค่า rate limiting (จาก config กลาง)
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: config.rateLimit.standardHeaders,
  legacyHeaders: config.rateLimit.legacyHeaders,
  message: config.rateLimit.message,
});

// ตั้งค่า middleware
app
  .use(helmet())
  .use(cors(config.corsOrigin))
  .use(cookieParser())
  .use(express.json({ limit: config.bodyLimit }))
  .use(express.urlencoded({ extended: true, limit: config.bodyLimit }))
  .use((req, _, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
  })
  .use(limiter);

// =================================================================================
// เรียกใช้ routes ทั้งหมดจาก src/app.js
const routes = require("./src/app");
app.use(routes);

// Use error middleware
app.use(errorMiddleware);

// ตรวจสอบการเชื่อมต่อเบื้องต้น
app.get("/health", (_, res) => {
  // ดึงข้อมูล version จาก package.json
  const pkg = require("./package.json");
  const version = pkg?.version ? pkg.version : "unknown";
  const mem = process.memoryUsage();
  // เช็คสถานะของ database
  const db = require("./src/config/db.config");
  db.getConnection((err, connection) => {
    let dbStatus = "disconnected";
    if (!err && connection) {
      connection.release();
      dbStatus = "connected";
    }
    // สร้าง response สำหรับ health check
    const healthCheck = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: NODE_ENV,
      database: dbStatus,
      version,
      memory: {
        used: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
        total: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
      },
    };
    // ส่ง response เป็น JSON
    res.status(200).json(healthCheck);
  });
});

// จัดการเส้นทางที่ไม่พบด้วยการส่ง 404
app.use((_, res) => {
  res.status(404).json({ message: "ไม่พบเส้นทางที่ร้องขอ" });
});

// =================================================================================
// Export function สำหรับ Firebase Functions v2
exports.api = onRequest(
  {
    region: "asia-southeast1",
    memory: "2GB",
    timeoutSeconds: 60,
    // เพิ่ม instanceConnections หากมีค่า INSTANCE_CONNECTION_NAME
    instanceConnections: process.env.INSTANCE_CONNECTION_NAME,
    // กำหนด service account ถ้ามี
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
  },
  app,
);

// =================================================================================
// เริ่มต้นเซิร์ฟเวอร์ (สำหรับการรัน Local หรือ Dev)
if (require.main === module) {
  const server = app.listen(config.port);

  // กำหนด base URL
  const baseUrl = `http://localhost:${config.port}`;
  // แสดงข้อความเมื่อเซิร์ฟเวอร์เริ่มทำงาน
  server.on("listening", () => {
    console.log(`🚀 Server running in ${NODE_ENV} mode`);
    console.log(`🌐 Local: ${baseUrl}`);
    console.log(`🛠️  Health Check: ${baseUrl}/health`);
    console.log(`🔧 Press Ctrl+C to stop the server`);
  });

  // จัดการข้อผิดพลาดของเซิร์ฟเวอร์
  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use`);
      console.error(
        `→ To fix: stop the process using the port or run with a different PORT (e.g. PORT=3001)`,
      );
      process.exit(1);
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });

  // ตัวจัดการปิดเซิร์ฟเวอร์อย่างปลอดภัยเมื่อเกิดข้อผิดพลาดที่ไม่คาดคิด
  process.on("unhandledRejection", (reason) => {
    // If this is an operational AppError, log and continue (don't crash the process)
    if (reason && typeof reason === "object") {
      const isOperational =
        reason.isOperational === true || reason instanceof AppError;
      if (isOperational) {
        console.warn(
          "Non-fatal unhandled rejection (operational):",
          reason.message || reason,
        );
        return;
      }
    }

    console.error("Unhandled Rejection:", reason);
    if (server?.close) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });
  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    if (server?.close) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });
}
