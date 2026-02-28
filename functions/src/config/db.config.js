const mysql = require("mysql2/promise");
const fs = require("node:fs");

/**
 * /config/database.js
 *
 * การเชื่อมต่อ MySQL พร้อมการรองรับ SSL และการแยกสภาพแวดล้อม
 * - Development: การเชื่อมต่อ TCP แบบง่าย (optional local SSL)
 * - Production: รองรับ Cloud Run (UNIX socket ผ่าน INSTANCE_CONNECTION_NAME) และ SSL certs
 *
 * Env vars (คำแนะนำ):
 *  - NODE_ENV=production|development
 *  - DB_USER, DB_PASS, DB_NAME, DB_HOST, DB_PORT
 *  - DB_CONN_LIMIT
 *  - INSTANCE_CONNECTION_NAME (for Cloud Run /cloudsql/<INSTANCE>)
 *  - DB_SSL_CA, DB_SSL_CERT, DB_SSL_KEY  (contents)
 *  - DB_SSL_CA_PATH, DB_SSL_CERT_PATH, DB_SSL_KEY_PATH  (file paths)
 */

const isProduction = process.env.NODE_ENV === "production";

// โหลด environment variables
const {
  DB_USER,
  DB_PASS,
  DB_NAME,
  DB_HOST,
  DB_PORT,
  DB_CONN_LIMIT,
  INSTANCE_CONNECTION_NAME,
  DB_SSL_CA,
  DB_SSL_CERT,
  DB_SSL_KEY,
  DB_SSL_CA_PATH,
  DB_SSL_CERT_PATH,
  DB_SSL_KEY_PATH,
} = process.env;

// ฟังก์ชันช่วยเหลือในการโหลด SSL certs
function loadSSLCert() {
  const ca = DB_SSL_CA || fs.readFileSync(DB_SSL_CA_PATH, "utf8");
  const cert = DB_SSL_CERT || fs.readFileSync(DB_SSL_CERT_PATH, "utf8");
  const key = DB_SSL_KEY || fs.readFileSync(DB_SSL_KEY_PATH, "utf8");

  // สร้างอ็อบเจ็กต์ SSL ถ้ามีข้อมูล
  const ssl = {};
  if (ca) ssl.ca = ca;
  if (cert) ssl.cert = cert;
  if (key) ssl.key = key;
  console.log("🔒 Loaded SSL certificates for database connection.");
  // คืนค่าอ็อบเจ็กต์ SSL หรือ null ถ้าไม่มี
  return Object.keys(ssl).length ? ssl : null;
}

// กำหนดการตั้งค่าการเชื่อมต่อฐานข้อมูล
const createPool = () => {
  let pool;

  // Common config
  const baseConfig = {
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    connectionLimit: Number.parseInt(DB_CONN_LIMIT || "10"),
  };

  if (isProduction && INSTANCE_CONNECTION_NAME) {
    // การตั้งค่าสำหรับ Production (Cloud Run via Socket)
    console.log("🔵 Connecting to production database (Socket)...");
    pool = mysql.createPool({
      ...baseConfig,
      socketPath: `/cloudsql/${INSTANCE_CONNECTION_NAME}`,
    });
  } else {
    // การตั้งค่าสำหรับ Development หรือ Production แบบ TCP
    console.log(
      `🔵 Connecting to database (TCP) at ${DB_HOST}:${DB_PORT || 3306}...`,
    );
    pool = mysql.createPool({
      ...baseConfig,
      host: DB_HOST,
      port: DB_PORT ? Number.parseInt(DB_PORT) : 3306,
      ssl: loadSSLCert(),
    });
  }

  console.log("🟢 Database pool created.");
  return pool;
};

/** --------------------------------------------------------------
 * ใช้สำหรับเชื่อมต่อฐานข้อมูล MySQL เพื่อทดสอบระบบ เพื่อไม่ให้กระทบกับฐานข้อมูลหลัก
 * ---------------------------------------------------------------
 */
const testPool = () => {
  // การตั้งค่าสำหรับ Testing (TCP connection)
  const testConfig = {
    host: "localhost",
    port: 3306,
    user: "myuser",
    password: "mypassword",
    database: "mydb",
    connectionLimit: 5,
  };
  console.log("🔵 Connecting to test database...");
  // Test connection database here if needed
  const pool = mysql.createPool(testConfig);
  console.log("🟢 Connected to test database.");
  return pool;
};

// สร้างพูลการเชื่อมต่อ สำหรับแอปหลัก
// const pool = createPool();

// สร้างพูลการเชื่อมต่อ สำหรับการทดสอบ
const pool = testPool();

// ส่งออกพูลการเชื่อมต่อ
module.exports = pool;
