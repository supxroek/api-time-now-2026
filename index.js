const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");

// โหลด environment variables จากไฟล์ .env
require("dotenv").config();

// สร้าง app Express
const app = express();

// กำหนดพอร์ตจาก environment variable หรือใช้ค่าเริ่มต้น 3000
const {
  NODE_ENV = "development",
  PORT = 3000,
  CORS_ORIGIN = "*",
  BODY_LIMIT = "100kb",
  RATE_LIMIT_WINDOW_MS = 60000,
  RATE_LIMIT_MAX = 100,
} = process.env;

// กำหนดตัวเลือก CORS
const corsOptions =
  CORS_ORIGIN === "*"
    ? { origin: true }
    : { origin: CORS_ORIGIN.split(",").map((s) => s.trim()) };

// ตั้งค่า rate limiting
const limiter = rateLimit({
  windowMs: Math.max(1, parseInt(RATE_LIMIT_WINDOW_MS, 10)) * 60 * 1000,
  max: parseInt(RATE_LIMIT_MAX, 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later.",
});

// ตั้งค่า middleware
app
  .use(helmet())
  .use(morgan("dev")) // ได้แก่ combined, common, dev, short, tiny
  .use(cors({ origin: corsOptions }))
  .use(express.json({ limit: BODY_LIMIT }))
  .use(express.urlencoded({ extended: false, limit: BODY_LIMIT }))
  .use(limiter);

/** --------------------------------------------------------------------
 * จัดการ route ต่างๆ ที่นี่
 */
const routes = require("./api/routes");
const { errorHandler } = require("./api/middleware/error.middleware");

// Mount all API routes
app.use(routes);

/** --------------------------------------------------------------------
 * route ตรวจสอบสถานะเซิร์ฟเวอร์
 */
app.get("/health", (req, res) => {
  // ดึงข้อมูล version จาก package.json
  const pkg = require("./package.json");
  const version = pkg && pkg.version ? pkg.version : "unknown";
  const mem = process.memoryUsage();
  // เช็คสถานะของ database
  const db = require("./config/database");
  db.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection error:", err);
      return res.status(500).json({
        status: "unhealthy",
        error: "Database connection error",
      });
    }
    if (connection) connection.release();
    return;
  });
  // สร้าง response สำหรับ health check
  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: NODE_ENV,
    database: db ? "connected" : "disconnected",
    version,
    memory: {
      used: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
    },
  };
  // ส่ง response เป็น JSON
  res.status(200).json(healthCheck);
});

/** --------------------------------------------------------------------
 * จัดการเส้นทางที่ไม่พบ (404) และข้อผิดพลาดที่ไม่ได้จัดการ (500)
 */
app
  .use((_, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  })
  .use(errorHandler); // ใช้ error handler จาก middleware

/** --------------------------------------------------------------------
 * เริ่มต้นเซิร์ฟเวอร์
 */
const server = app.listen(PORT);
// กำหนด base URL
const baseUrl = `http://localhost:${PORT}`;
// แสดงข้อความเมื่อเซิร์ฟเวอร์เริ่มทำงาน
server.on("listening", () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode`);
  console.log(`🌐 Local: ${baseUrl}`);
  console.log(`🛠️  Health Check: ${baseUrl}/health`);
  console.log(`🔧 Press Ctrl+C to stop the server`);
});
// จัดการข้อผิดพลาดของเซิร์ฟเวอร์
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error(
      `→ To fix: stop the process using the port or run with a different PORT (e.g. PORT=3001)`
    );
    process.exit(1);
  } else {
    console.error("Server error:", err);
    process.exit(1);
  }
});

/** --------------------------------------------------------------------
 * ตัวจัดการปิดเซิร์ฟเวอร์อย่างปลอดภัยเมื่อเกิดข้อผิดพลาดที่ไม่คาดคิด
 */
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  if (server && server.close) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  if (server && server.close) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});
