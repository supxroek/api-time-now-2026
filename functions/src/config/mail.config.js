const nodemailer = require("nodemailer");

// โหลดตัวแปรสภาพแวดล้อมจากไฟล์ .env
require("dotenv").config();

// โหลดค่าการตั้งค่าอีเมลจากตัวแปรสภาพแวดล้อม
const {
  EMAIL_FROM_NAME,
  EMAIL_FROM_ADDRESS,
  EMAIL_CLIENT_ID,
  EMAIL_CLIENT_SECRET,
  EMAIL_REFRESH_TOKEN,
} = process.env;

class MailConfig {
  // กำหนดค่าการตั้งค่าอีเมลจากตัวแปรสภาพแวดล้อม
  constructor() {
    this.fromName = EMAIL_FROM_NAME;
    this.fromAddress = EMAIL_FROM_ADDRESS;
    this.clientId = EMAIL_CLIENT_ID;
    this.clientSecret = EMAIL_CLIENT_SECRET;
    this.refreshToken = EMAIL_REFRESH_TOKEN;
  }

  // ฟังก์ชันสร้าง transporter สำหรับส่งอีเมล
  createTransporter() {
    // สร้าง transporter สำหรับส่งอีเมล
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: this.fromAddress,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        refreshToken: this.refreshToken,
      },
    });
    return transporter;
  }
}

module.exports = new MailConfig();
