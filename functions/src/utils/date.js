const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const buddhistEra = require("dayjs/plugin/buddhistEra");
require("dayjs/locale/th");

dayjs.extend(utc); // ตั้งค่า dayjs ให้รองรับ UTC
dayjs.extend(timezone); // ตั้งค่า dayjs ให้รองรับ Timezone
dayjs.extend(buddhistEra); // ตั้งค่า dayjs ให้รองรับปฏิทินพุทธศักราช
dayjs.locale("th"); // ตั้งค่าภาษาเริ่มต้นเป็นภาษาไทย

// Default timezone for users (Thailand)
const DEFAULT_TZ = "Asia/Bangkok";

/**
 * ทำการมาตรฐานรูปแบบวันที่ต่างๆ ให้เป็นสตริง DATE ของ MySQL (YYYY-MM-DD)
 * - ถ้า `input` เป็นสตริงวันที่เพียงอย่างเดียวอยู่แล้ว (YYYY-MM-DD) จะส่งกลับค่าเดิม
 * - ถ้า `input` เป็นวันที่ ISO (เช่น ถูกสร้างโดย toISOString จากเที่ยงคืนท้องถิ่น)
 *   จะตีความตามโซนเวลาของผู้ใช้ (DEFAULT_TZ) เพื่อให้วันที่ที่เก็บตรงกับวันที่ผู้ใช้เลือกใน UI
 *   จะส่งกลับค่า null หากค่า input เป็นค่าที่ไม่ถูกต้องหรือว่าง
 */
function normalizeDate(input) {
  if (!input) return null;
  const asString = String(input).trim();
  // Quick match for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;

  // Parse ISO and convert to user's timezone then extract date
  const d = dayjs(asString).utc().tz(DEFAULT_TZ);
  if (!d.isValid()) return null;
  return d.format("YYYY-MM-DD");
}

/**
 * ฟังก์ชันจัดรูปแบบวันที่เป็นสตริงในรูปแบบ "D MMMM BBBB" (เช่น "1 มกราคม 2567")
 * โดยใช้ไลบรารี dayjs และตั้งค่าให้แสดงผลเป็นภาษาไทย
 * หาก input เป็นค่าว่างหรือไม่ถูกต้อง จะคืนค่าเป็น "-"
 */
function formatDateThai(input) {
  if (!input) return "-";
  return dayjs(input).format("D MMMM BBBB");
}

/**
 * ปกติค่า TIME จาก MySQL driver มักจะส่งกลับมาเป็น String "HH:mm:ss"
 * แต่บางครั้งอาจมีการตั้งค่า driver ให้ส่งมาเป็น Object หรือต้องการ normalize format
 * ฟังก์ชันนี้จะแปลงค่าให้เป็น String "HH:mm:ss" เสมอ
 */
function normalizeTime(input) {
  if (!input) return null;

  // กรณีค่าเป็น String "HH:mm:ss" หรือ "HH:mm"
  if (typeof input === "string") {
    // ถ้ามี format HH:mm:ss หรือ HH:mm
    // ใช้ Regex ตรวจจับ pattern
    const match = /^(\d{1,2}):(\d{2})(:(\d{2}))?$/.exec(input);
    if (match) {
      let [, h, m, , s] = match;
      s = s || "00";
      // padZero ให้เป็น 2 หลัก
      return `${h.padStart(2, "0")}:${m}:${s}`;
    }
  }

  // กรณีเป็น Date object (เช่น driver แปลงมาให้)
  // หรือ string ที่ dayjs อ่านออก (เช่น full datetime string)
  const d = dayjs(input);
  if (d.isValid()) {
    return d.format("HH:mm:ss");
  }

  // กรณีไม่สามารถแปลงได้ ส่งค่าเดิมกลับไป (หรืออาจจะ return null)
  return input;
}

module.exports = { normalizeDate, formatDateThai, normalizeTime };
