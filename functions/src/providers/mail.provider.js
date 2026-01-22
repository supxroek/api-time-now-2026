const mailConfig = require("../config/mail.config");

// Create transporter once
const transporter = mailConfig.createTransporter();

// ฟังก์ชันส่งอีเมล
async function sendMail({ to, subject, text, html, from, attachments }) {
  const fromAddress = `${mailConfig.fromName} <${mailConfig.fromAddress}>`;
  const mailOptions = {
    from: from || fromAddress, // ผู้ส่ง
    to, // ผู้รับ
    subject, // หัวข้ออีเมล
    text, // เนื้อหาแบบข้อความธรรมดา
    html, // เนื้อหาแบบ HTML
    attachments, // เพิ่มการรองรับไฟล์แนบ (ถ้ามี)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { ok: true, info };
  } catch (err) {
    console.error("mail.provider.sendMail error:", err);
    throw err;
  }
}

module.exports = {
  sendMail,
};
