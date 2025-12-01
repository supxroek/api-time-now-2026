/**
 * /api/models/overtime.model.js
 *
 * Overtime Model - Time Configuration Domain
 * กำหนดช่วงเวลา OT และกฎการทำ OT
 *
 * Relationships:
 *   - belongsTo -> Company
 *
 * Note: ฟิลด์ employeeId เป็น longtext (array ของ id พนักงาน)
 *       ต้องมี Helper Function สำหรับ parse และตรวจสอบสิทธิ์การทำ OT
 */

const BaseModel = require("./base.model");

class OvertimeModel extends BaseModel {
  constructor() {
    super(
      "overtime", // tableName
      "id", // primaryKey
      [], // hiddenFields
      [
        // fillable fields
        "company_id",
        "overtime_name",
        "overtime_code",
        "start_time",
        "end_time",
        "multiplier",
        "min_hours",
        "max_hours",
        "requires_approval",
        "employeeId",
        "applicable_days",
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

    try {
      const parsed = JSON.parse(employeeIdText);
      if (Array.isArray(parsed)) {
        return parsed.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
      }
    } catch (e) {
      // ไม่ใช่ JSON
    }

    return employeeIdText
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));
  }

  /** -----------------------------------------------------------------------
   * แปลง Array ของ Employee IDs เป็น String สำหรับบันทึก
   */
  stringifyEmployeeIds(employeeIds) {
    if (!Array.isArray(employeeIds)) return "";
    return JSON.stringify(employeeIds);
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบสิทธิ์การทำ OT ของพนักงาน
   */
  checkEmployeeOTPermission(overtime, employeeId) {
    if (!overtime || !overtime.employeeId) return false;

    // ถ้า employeeId ว่าง หมายถึงทุกคนสามารถทำ OT ได้
    if (overtime.employeeId === "" || overtime.employeeId === "[]") {
      return true;
    }

    const employeeIds = this.parseEmployeeIds(overtime.employeeId);
    return employeeIds.includes(parseInt(employeeId, 10));
  }

  /** -----------------------------------------------------------------------
   * ดึง Employee IDs ที่มีสิทธิ์ทำ OT
   */
  async getEmployeeIds(overtimeId) {
    const overtime = await this.findById(overtimeId);
    if (!overtime) return [];
    return this.parseEmployeeIds(overtime.employeeId);
  }

  // ========================================
  // Custom Queries
  // ========================================

  /** -----------------------------------------------------------------------
   * ค้นหา OT rules ทั้งหมดของบริษัท
   */
  async findByCompany(companyId) {
    return this.findAll({
      where: { company_id: companyId },
      orderBy: "overtime_name ASC",
    });
  }

  /** -----------------------------------------------------------------------
   * ค้นหา OT rules ที่ Active
   */
  async findActiveByCompany(companyId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE company_id = ? AND status = 'active'
      ORDER BY overtime_name ASC
    `;
    return this.query(sql, [companyId]);
  }

  /** -----------------------------------------------------------------------
   * ค้นหา OT rule จาก Code
   */
  async findByCode(companyId, overtimeCode) {
    return this.findOne({
      company_id: companyId,
      overtime_code: overtimeCode,
    });
  }

  /** -----------------------------------------------------------------------
   * ค้นหา OT rules ที่พนักงานมีสิทธิ์
   */
  async findByEmployee(companyId, employeeId) {
    const allRules = await this.findActiveByCompany(companyId);

    return allRules.filter((rule) =>
      this.checkEmployeeOTPermission(rule, employeeId)
    );
  }

  /** -----------------------------------------------------------------------
   * ค้นหา OT rules พร้อมจำนวนพนักงานที่มีสิทธิ์
   */
  async findWithEmployeeCount(companyId) {
    const rules = await this.findByCompany(companyId);

    return rules.map((rule) => ({
      ...rule,
      employee_count: this.parseEmployeeIds(rule.employeeId).length,
    }));
  }

  /** -----------------------------------------------------------------------
   * เพิ่มพนักงานเข้า OT rule
   */
  async addEmployee(overtimeId, employeeId) {
    const overtime = await this.findById(overtimeId);
    if (!overtime) return false;

    const employeeIds = this.parseEmployeeIds(overtime.employeeId);

    if (employeeIds.includes(parseInt(employeeId, 10))) {
      return true;
    }

    employeeIds.push(parseInt(employeeId, 10));

    const sql = `
      UPDATE ${this.tableName} 
      SET employeeId = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await this.pool.execute(sql, [
      this.stringifyEmployeeIds(employeeIds),
      overtimeId,
    ]);
    return true;
  }

  /** -----------------------------------------------------------------------
   * ลบพนักงานออกจาก OT rule
   */
  async removeEmployee(overtimeId, employeeId) {
    const overtime = await this.findById(overtimeId);
    if (!overtime) return false;

    let employeeIds = this.parseEmployeeIds(overtime.employeeId);
    employeeIds = employeeIds.filter((id) => id !== parseInt(employeeId, 10));

    const sql = `
      UPDATE ${this.tableName} 
      SET employeeId = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await this.pool.execute(sql, [
      this.stringifyEmployeeIds(employeeIds),
      overtimeId,
    ]);
    return true;
  }

  /** -----------------------------------------------------------------------
   * คำนวณค่า OT
   */
  calculateOTPayment(overtimeRule, hours, hourlyRate) {
    if (!overtimeRule) {
      return { validHours: 0, payment: 0 };
    }

    const minHours = overtimeRule.min_hours || 0;
    const maxHours = overtimeRule.max_hours || 24;
    const multiplier = overtimeRule.multiplier || 1.5;

    // ตรวจสอบชั่วโมงขั้นต่ำ
    if (hours < minHours) {
      return { validHours: 0, payment: 0, reason: "Below minimum hours" };
    }

    // จำกัดชั่วโมงสูงสุด
    const validHours = Math.min(hours, maxHours);
    const payment = validHours * hourlyRate * multiplier;

    return {
      validHours,
      payment: Math.round(payment * 100) / 100,
      multiplier,
    };
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่าเวลาอยู่ในช่วง OT หรือไม่
   */
  isInOTTimeRange(overtimeRule, time) {
    if (!overtimeRule || !overtimeRule.start_time || !overtimeRule.end_time) {
      return false;
    }

    const [startHour, startMin] = overtimeRule.start_time
      .split(":")
      .map(Number);
    const [endHour, endMin] = overtimeRule.end_time.split(":").map(Number);
    const [checkHour, checkMin] = time.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const checkMinutes = checkHour * 60 + checkMin;

    // รองรับกรณี OT ข้ามวัน (เช่น 22:00 - 06:00)
    if (endMinutes < startMinutes) {
      return checkMinutes >= startMinutes || checkMinutes <= endMinutes;
    }

    return checkMinutes >= startMinutes && checkMinutes <= endMinutes;
  }
}

module.exports = new OvertimeModel();
