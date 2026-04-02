const nodemailer = require("nodemailer");

// โหลดตัวแปรสภาพแวดล้อมจากไฟล์ .env
require("dotenv").config();

const {
  // สำหรับ SMTP
  EMAIL_FROM_NAME,
  EMAIL_FROM_ADDRESS,
  MEMAIL_SMTP_HOST,
  MEMAIL_SMTP_PORT,
  MEMAIL_SMTP_USER,
  MEMAIL_SMTP_PASS,
} = process.env;

class MailConfig {
  // กำหนดค่าการตั้งค่าอีเมลจากตัวแปรสภาพแวดล้อม
  constructor() {
    this.fromName = EMAIL_FROM_NAME;
    this.fromAddress = EMAIL_FROM_ADDRESS;
    this.host = MEMAIL_SMTP_HOST;
    this.port = Number(MEMAIL_SMTP_PORT) || 587;
    this.user = MEMAIL_SMTP_USER;
    this.pass = MEMAIL_SMTP_PASS;
  }

  // ฟังก์ชันสร้าง transporter สำหรับส่งอีเมล ผ่าน SMTP
  createTransporter() {
    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port, // 587 → STARTTLS
      secure: this.port === 465, // ถ้าใช้ 465/2465 ค่อยให้เป็น true
      auth: {
        user: this.user,
        pass: this.pass,
      },
    });
    return transporter;
  }
}

module.exports = new MailConfig();
