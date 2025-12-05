/**
 * Utility functions for date manipulation and formatting
 * สำหรับจัดการและฟอร์แมตรูปแบบวันที่และอื่นๆ โดยใช้ Library: dayjs
 *
 * ฟังก์ชันที่มีเฉพาะที่ใช้งานจริงในระบบ:
 * - now()              : เวลาปัจจุบัน
 * - parse()            : แปลง string/Date เป็น dayjs
 * - parseISOToDate()   : แปลง ISO string เป็น Date object
 * - isValid()          : ตรวจสอบว่า valid หรือไม่
 * - isBefore()         : A < B
 * - isAfter()          : A > B
 * - toDbDate()         : format เป็น "YYYY-MM-DD"
 * - toDbDatetime()     : format เป็น "YYYY-MM-DD HH:mm:ss"
 * - getExpirationDate(): คำนวณวันหมดอายุจาก duration string
 */

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

// เพิ่มปลั๊กอินที่จำเป็น
dayjs.extend(utc);
dayjs.extend(timezone);

// ==================== Constants ====================
const DEFAULT_TIMEZONE = "Asia/Bangkok";

const DATE_FORMATS = {
  DB_DATE: "YYYY-MM-DD",
  DB_DATETIME: "YYYY-MM-DD HH:mm:ss",
};

// Date Utility Class
class DateUtil {
  constructor() {
    this.timezone = DEFAULT_TIMEZONE;
    this.formats = DATE_FORMATS;
  }

  // ==================== Core Methods ====================

  /**
   * ดึงเวลาปัจจุบันตาม timezone ที่กำหนด
   */
  now() {
    return dayjs().tz(this.timezone);
  }

  // ==================== Parse Methods ====================

  /**
   * แปลง string/Date เป็น dayjs object พร้อม timezone
   */
  parse(dateInput) {
    if (!dateInput) return null;
    const parsed = dayjs(dateInput).tz(this.timezone);
    return parsed.isValid() ? parsed : null;
  }

  /**
   * แปลง ISO string เป็น Date object
   */
  parseISOToDate(isoString) {
    const parsed = this.parse(isoString);
    return parsed ? parsed.toDate() : null;
  }

  // ==================== Format Methods ====================

  /**
   * Format วันที่สำหรับบันทึกลง Database (DATE column)
   */
  toDbDate(dateInput) {
    const parsed = this.parse(dateInput);
    return parsed ? parsed.format(DATE_FORMATS.DB_DATE) : null;
  }

  /**
   * Format วันที่และเวลาสำหรับบันทึกลง Database (DATETIME/TIMESTAMP)
   */
  toDbDatetime(dateInput) {
    const parsed = this.parse(dateInput);
    return parsed ? parsed.format(DATE_FORMATS.DB_DATETIME) : null;
  }

  // ==================== Validation Methods ====================

  /**
   * ตรวจสอบว่าค่าที่รับมาเป็นวันที่ที่ valid หรือไม่
   */
  isValid(dateInput) {
    if (!dateInput) return false;
    return dayjs(dateInput).isValid();
  }

  /**
   * ตรวจสอบว่าวันที่ A อยู่ก่อนวันที่ B หรือไม่
   * @param {string|Date|dayjs.Dayjs} dateA - วันที่ A
   * @param {string|Date|dayjs.Dayjs} dateB - วันที่ B
   * @returns {boolean} true ถ้า A < B
   */
  isBefore(dateA, dateB) {
    const a = this.parse(dateA);
    const b = this.parse(dateB);
    if (!a || !b) return false;
    return a.isBefore(b);
  }

  /**
   * ตรวจสอบว่าวันที่ A อยู่หลังวันที่ B หรือไม่
   * @param {string|Date|dayjs.Dayjs} dateA - วันที่ A
   * @param {string|Date|dayjs.Dayjs} dateB - วันที่ B
   * @returns {boolean} true ถ้า A > B
   */
  isAfter(dateA, dateB) {
    const a = this.parse(dateA);
    const b = this.parse(dateB);
    if (!a || !b) return false;
    return a.isAfter(b);
  }

  // ==================== Calculation Methods ====================

  /**
   * คำนวณวันหมดอายุจาก duration string (เช่น "1h", "7d", "30m")
   * ใช้สำหรับ token expiration
   */
  getExpirationDate(durationStr) {
    const regex = /(\d+)([smhd])/g;
    let match;
    let totalMs = 0;

    while ((match = regex.exec(durationStr)) !== null) {
      const value = Number.parseInt(match[1], 10);
      const unit = match[2];
      switch (unit) {
        case "s":
          totalMs += value * 1000;
          break;
        case "m":
          totalMs += value * 60 * 1000;
          break;
        case "h":
          totalMs += value * 60 * 60 * 1000;
          break;
        case "d":
          totalMs += value * 24 * 60 * 60 * 1000;
          break;
      }
    }

    return this.now().add(totalMs, "millisecond").toDate();
  }
}

module.exports = new DateUtil();
