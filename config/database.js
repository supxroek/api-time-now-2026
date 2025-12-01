const mysql = require("mysql2/promise");
const fs = require("fs");

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
  const ca = DB_SSL_CA_PATH
    ? fs.readFileSync(DB_SSL_CA_PATH, "utf8")
    : DB_SSL_CA;
  const cert = DB_SSL_CERT_PATH
    ? fs.readFileSync(DB_SSL_CERT_PATH, "utf8")
    : DB_SSL_CERT;
  const key = DB_SSL_KEY_PATH
    ? fs.readFileSync(DB_SSL_KEY_PATH, "utf8")
    : DB_SSL_KEY;

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
  if (isProduction) {
    // การตั้งค่าสำหรับ Production (Cloud Run)
    const socketPath = INSTANCE_CONNECTION_NAME
      ? `/cloudsql/${INSTANCE_CONNECTION_NAME}`
      : undefined;

    // การตั้งค่าการเชื่อมต่อผ่าน UNIX socket
    const prodConfig = {
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      connectionLimit: parseInt(DB_CONN_LIMIT),
      socketPath,
    };

    // สร้างการเชื่อมต่อพูล
    console.log("🔵 Connecting to production database...");
    pool = mysql.createPool(prodConfig);
    console.log("🟢 Connected to production database.");
  } else {
    // การตั้งค่าสำหรับ Development (TCP connection)
    const devConfig = {
      host: DB_HOST,
      port: DB_PORT ? parseInt(DB_PORT) : 3306,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      connectionLimit: parseInt(DB_CONN_LIMIT),
      ssl: loadSSLCert(),
    };

    // สร้างการเชื่อมต่อพูล
    console.log("🔵 Connecting to development database...");
    pool = mysql.createPool(devConfig);
    console.log("🟢 Connected to development database.");
  }
  return pool;
};
// สร้างพูลการเชื่อมต่อ
const pool = createPool();

// ส่งออกพูลการเชื่อมต่อ
module.exports = pool;
