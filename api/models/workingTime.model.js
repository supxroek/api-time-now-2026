/**
 * /api/models/workingTime.model.js
 *
 * WorkingTime Model - Time Configuration Domain
 * กำหนดกะงาน (Shift), เวลาเข้า-ออก, วันหยุด
 *
 * Relationships:
 *   - belongsTo -> Company
 *
 * Note: ฟิลด์ employeeId เป็น longtext (array ของ id พนักงาน)
 *       ต้องมี Helper Function สำหรับ parse และตรวจสอบ
 */

const BaseModel = require("./base.model");

class WorkingTimeModel extends BaseModel {
  constructor() {
    super(
      "workingTime", // tableName
      "id", // primaryKey
      [], // hiddenFields
      [
        // fillable fields
        "company_id",
        "shift_name",
        "shift_code",
        "check_in_time",
        "check_out_time",
        "break_start",
        "break_end",
        "break_duration_minutes",
        "late_threshold_minutes",
        "early_leave_threshold_minutes",
        "working_days",
        "employeeId",
        "date",
        "is_flexible",
        "status",
      ]
    );
  }

  // ========================================
  // Employee ID Parsing Helpers
  // ========================================

  /** -----------------------------------------------------------------------
   * แปลง employeeId (longtext/comma-separated) เป็น Array
   */
  parseEmployeeIds(employeeIdText) {
    if (!employeeIdText) return [];

    // รองรับทั้ง JSON array และ comma-separated
    try {
      // ลอง parse เป็น JSON ก่อน
      const parsed = JSON.parse(employeeIdText);
      if (Array.isArray(parsed)) {
        return parsed.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
      }
    } catch (e) {
      // ไม่ใช่ JSON, ลอง split ด้วย comma
    }

    return employeeIdText
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));
  }

  /** -----------------------------------------------------------------------
   * แปลง Array ของ Employee IDs เป็น String สำหรับบันทึก
   * @param {Array<number>} employeeIds
   * @returns {string}
   */
  stringifyEmployeeIds(employeeIds) {
    if (!Array.isArray(employeeIds)) return "";
    return JSON.stringify(employeeIds);
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่าพนักงานอยู่ในกะนี้หรือไม่
   */
  checkEmployeeInShift(workingTime, employeeId) {
    if (!workingTime || !workingTime.employeeId) return false;
    const employeeIds = this.parseEmployeeIds(workingTime.employeeId);
    return employeeIds.includes(parseInt(employeeId, 10));
  }

  /**
   * ดึง Employee IDs จากกะงาน
   * @param {number} workingTimeId
   * @returns {Promise<Array<number>>}
   */
  async getEmployeeIds(workingTimeId) {
    const workingTime = await this.findById(workingTimeId);
    if (!workingTime) return [];
    return this.parseEmployeeIds(workingTime.employeeId);
  }

  // ========================================
  // Working Days Helpers
  // ========================================

  /** -----------------------------------------------------------------------
   * แปลง working_days เป็น Array ของวัน (0-6, 0=อาทิตย์)
   */
  parseWorkingDays(workingDaysText) {
    if (!workingDaysText) return [1, 2, 3, 4, 5]; // Default: จันทร์-ศุกร์

    try {
      const parsed = JSON.parse(workingDaysText);
      if (Array.isArray(parsed)) {
        return parsed
          .map((d) => parseInt(d, 10))
          .filter((d) => d >= 0 && d <= 6);
      }
    } catch (e) {
      // ไม่ใช่ JSON
    }

    return workingDaysText
      .split(",")
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => d >= 0 && d <= 6);
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่าวันนี้เป็นวันทำงานหรือไม่
   */
  isWorkingDay(workingTime, date = new Date()) {
    const dayOfWeek = date.getDay(); // 0-6
    const workingDays = this.parseWorkingDays(workingTime.working_days);
    return workingDays.includes(dayOfWeek);
  }

  // ========================================
  // Custom Queries
  // ========================================

  /** -----------------------------------------------------------------------
   * ค้นหากะงานทั้งหมดของบริษัท
   */
  async findByCompany(companyId) {
    return this.findAll({
      where: { company_id: companyId },
      orderBy: "shift_name ASC",
    });
  }

  /** -----------------------------------------------------------------------
   * ค้นหากะงานจาก Code
   */
  async findByCode(companyId, shiftCode) {
    return this.findOne({
      company_id: companyId,
      shift_code: shiftCode,
    });
  }

  /** -----------------------------------------------------------------------
   * ค้นหากะงานของพนักงาน
   */
  async findByEmployee(companyId, employeeId) {
    const allShifts = await this.findByCompany(companyId);

    for (const shift of allShifts) {
      if (this.checkEmployeeInShift(shift, employeeId)) {
        return shift;
      }
    }

    return null;
  }

  /** -----------------------------------------------------------------------
   * ค้นหากะงานพร้อมจำนวนพนักงาน
   */
  async findWithEmployeeCount(companyId) {
    const shifts = await this.findByCompany(companyId);

    return shifts.map((shift) => ({
      ...shift,
      employee_count: this.parseEmployeeIds(shift.employeeId).length,
      working_days_list: this.parseWorkingDays(shift.working_days),
    }));
  }

  /** -----------------------------------------------------------------------
   * เพิ่มพนักงานเข้ากะ
   */
  async addEmployee(workingTimeId, employeeId) {
    const workingTime = await this.findById(workingTimeId);
    if (!workingTime) return false;

    const employeeIds = this.parseEmployeeIds(workingTime.employeeId);

    // ตรวจสอบว่ามีอยู่แล้วหรือไม่
    if (employeeIds.includes(parseInt(employeeId, 10))) {
      return true; // มีอยู่แล้ว
    }

    employeeIds.push(parseInt(employeeId, 10));

    const sql = `
      UPDATE ${this.tableName} 
      SET employeeId = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await this.pool.execute(sql, [
      this.stringifyEmployeeIds(employeeIds),
      workingTimeId,
    ]);
    return true;
  }

  /** -----------------------------------------------------------------------
   * ลบพนักงานออกจากกะ
   */
  async removeEmployee(workingTimeId, employeeId) {
    const workingTime = await this.findById(workingTimeId);
    if (!workingTime) return false;

    let employeeIds = this.parseEmployeeIds(workingTime.employeeId);
    employeeIds = employeeIds.filter((id) => id !== parseInt(employeeId, 10));

    const sql = `
      UPDATE ${this.tableName} 
      SET employeeId = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await this.pool.execute(sql, [
      this.stringifyEmployeeIds(employeeIds),
      workingTimeId,
    ]);
    return true;
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่าพนักงานมาสายหรือไม่
   */
  checkLateStatus(workingTime, checkInTime) {
    if (!workingTime || !checkInTime) {
      return { isLate: false, lateMinutes: 0 };
    }

    const [scheduledHour, scheduledMin] = workingTime.check_in_time
      .split(":")
      .map(Number);
    const [actualHour, actualMin] = checkInTime.split(":").map(Number);

    const scheduledMinutes = scheduledHour * 60 + scheduledMin;
    const actualMinutes = actualHour * 60 + actualMin;
    const threshold = workingTime.late_threshold_minutes || 0;

    const diffMinutes = actualMinutes - scheduledMinutes;
    const isLate = diffMinutes > threshold;

    return {
      isLate,
      lateMinutes: isLate ? diffMinutes : 0,
    };
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่าพนักงานออกก่อนเวลาหรือไม่
   */
  checkEarlyLeaveStatus(workingTime, checkOutTime) {
    if (!workingTime || !checkOutTime) {
      return { isEarlyLeave: false, earlyMinutes: 0 };
    }

    const [scheduledHour, scheduledMin] = workingTime.check_out_time
      .split(":")
      .map(Number);
    const [actualHour, actualMin] = checkOutTime.split(":").map(Number);

    const scheduledMinutes = scheduledHour * 60 + scheduledMin;
    const actualMinutes = actualHour * 60 + actualMin;
    const threshold = workingTime.early_leave_threshold_minutes || 0;

    const diffMinutes = scheduledMinutes - actualMinutes;
    const isEarlyLeave = diffMinutes > threshold;

    return {
      isEarlyLeave,
      earlyMinutes: isEarlyLeave ? diffMinutes : 0,
    };
  }
}

module.exports = new WorkingTimeModel();
