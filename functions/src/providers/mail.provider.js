const mailConfig = require("../config/mail.config");
const axios = require("axios");

// Create transporter once
const transporter = mailConfig.createTransporter();

const {
  // สำหรับ API
  MEMAIL_API_BASE,
  MEMAIL_API_USERNAME,
  MEMAIL_API_PASSWORD,
  MEMAIL_API_TENANT_ID,
  MEMAIL_API_FROM,
} = process.env;

// --- Helper: login เพื่อขอ token ---
async function getMeMailToken() {
  try {
    const res = await axios.post(`${MEMAIL_API_BASE}/login`, {
      username: MEMAIL_API_USERNAME,
      password: MEMAIL_API_PASSWORD,
    });
    return res.data?.accessToken;
  } catch (err) {
    if (err.response) {
      const { status, data } = err.response;
      throw new Error(`MeMail login failed: ${status} ${JSON.stringify(data)}`);
    }
    throw new Error(`MeMail login failed: ${err.message}`);
  }
}

// --- ฟังก์ชันส่งอีเมลผ่าน API ของ Memail ---
async function sendMailApi({ to, subject, html, from, tenant, attachments }) {
  const token = await getMeMailToken();

  const payload = {
    to,
    from: from || MEMAIL_API_FROM,
    subject,
    html,
    tenant: tenant || MEMAIL_API_TENANT_ID,
  };

  if (attachments?.length) {
    payload.attachments = attachments; // คาดว่าเป็น { filename, content, contentType }
  }

  try {
    const res = await axios.post(`${MEMAIL_API_BASE}/send`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    return { ok: true, via: "api", data: res.data };
  } catch (err) {
    if (err.response) {
      const { status, data } = err.response;
      throw new Error(
        `MeMail API send failed: ${status} ${JSON.stringify(data)}`,
      );
    }
    throw err;
  }
}

// --- ฟังก์ชันส่งอีเมลผ่าน STMP ของ MeMail ---
async function sendMail({
  to,
  subject,
  text,
  html,
  tenant,
  from,
  attachments,
}) {
  const fromAddress = `${mailConfig.fromName} <${mailConfig.fromAddress}>`;
  const mailOptions = {
    from: from || fromAddress, // ผู้ส่ง
    to, // ผู้รับ
    subject, // หัวข้ออีเมล
    text, // เนื้อหาแบบข้อความธรรมดา
    html, // เนื้อหาแบบ HTML
    tenant,
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
  sendMailApi,
};
