/**
 * /api/models/device.model.js
 *
 * DevIO Model - Hardware Domain
 * จัดการอุปกรณ์ IoT/จุดสแกน
 *
 * Relationships:
 *   - belongsTo -> Company
 *
 * Note: ฟิลด์ employeeId (longtext) ใช้เก็บว่าใครมีสิทธิ์สแกนเครื่องนี้บ้าง
 */

const BaseModel = require("./base.model");

// Enum สำหรับ Device Type
const DEVICE_TYPE = {
  FINGERPRINT: "fingerprint", // ลายนิ้วมือ
  FACE_RECOGNITION: "face_recognition", // จดจำใบหน้า
  CARD_READER: "card_reader", // อ่านบัตร
  QR_SCANNER: "qr_scanner", // สแกน QR Code
  MOBILE: "mobile", // แอปมือถือ
  WEB: "web", // เว็บ
};

// Enum สำหรับ Device Status
const DEVICE_STATUS = {
  ACTIVE: "active", // ใช้งานได้ปกติ
  INACTIVE: "inactive", // ปิดการใช้งาน
  MAINTENANCE: "maintenance", // กำลังซ่อมบำรุง
  OFFLINE: "offline", // ออฟไลน์
};

// สืบทอดมาจาก BaseModel
class DevIOModel extends BaseModel {
  constructor() {
    super(
      "devIO", // tableName - ชื่อ table
      "id", // primaryKey
      ["api_key", "secret_key"], // hiddenFields - ซ่อน credentials
      [
        // fillable fields - ฟิลด์ที่อนุญาตให้แก้ไข
        "company_id",
        "device_name",
        "device_code",
        "device_type",
        "hwid",
        "location_name",
        "location_lat",
        "location_lng",
        "ip_address",
        "mac_address",
        "firmware_version",
        "employeeId",
        "allow_check_in",
        "allow_check_out",
        "allow_break",
        "status",
        "last_heartbeat",
        "notes",
      ]
    );

    // Export enums
    this.TYPE = DEVICE_TYPE;
    this.STATUS = DEVICE_STATUS;
  }

  // ========================================
  // Employee ID Parsing Helpers
  // ========================================

  /** -----------------------------------------------------------------------
   * แปลง employeeId (longtext) เป็น Array
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
   * แปลง Array ของ Employee IDs เป็น String
   */
  stringifyEmployeeIds(employeeIds) {
    if (!Array.isArray(employeeIds)) return "";
    return JSON.stringify(employeeIds);
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบสิทธิ์การใช้งานอุปกรณ์
   * @param {number} employeeId - ID พนักงาน
   * @param {string} hwid - Hardware ID ของอุปกรณ์
   * @returns {Promise<Object>} - { allowed, device, reason }
   */
  async verifyAccess(employeeId, hwid) {
    // ค้นหาอุปกรณ์จาก hwid
    const device = await this.findByHwid(hwid);

    if (!device) {
      return { allowed: false, device: null, reason: "Device not found" };
    }

    if (device.status !== DEVICE_STATUS.ACTIVE) {
      return { allowed: false, device, reason: "Device is not active" };
    }

    // ตรวจสอบว่าพนักงานมีสิทธิ์หรือไม่
    // ถ้า employeeId ว่าง หมายถึงทุกคนใช้ได้
    if (
      !device.employeeId ||
      device.employeeId === "" ||
      device.employeeId === "[]"
    ) {
      return { allowed: true, device, reason: "Open access" };
    }

    const allowedEmployees = this.parseEmployeeIds(device.employeeId);
    const hasAccess = allowedEmployees.includes(parseInt(employeeId, 10));

    return {
      allowed: hasAccess,
      device,
      reason: hasAccess ? "Authorized" : "Not authorized for this device",
    };
  }

  // ========================================
  // Custom Queries
  // ========================================

  /** -----------------------------------------------------------------------
   * ค้นหาอุปกรณ์ทั้งหมดของบริษัท
   */
  async findByCompany(companyId) {
    return this.findAll({
      where: { company_id: companyId },
      orderBy: "device_name ASC",
    });
  }

  /** -----------------------------------------------------------------------
   * ค้นหาอุปกรณ์ที่ Active
   */
  async findActiveByCompany(companyId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE company_id = ? AND status = ?
      ORDER BY device_name ASC
    `;
    return this.query(sql, [companyId, DEVICE_STATUS.ACTIVE]);
  }

  /** -----------------------------------------------------------------------
   * ค้นหาอุปกรณ์จาก HWID
   */
  async findByHwid(hwid) {
    return this.findOne({ hwid });
  }

  /** -----------------------------------------------------------------------
   * ค้นหาอุปกรณ์จาก Code
   */
  async findByCode(companyId, deviceCode) {
    return this.findOne({
      company_id: companyId,
      device_code: deviceCode,
    });
  }

  /** -----------------------------------------------------------------------
   * ค้นหาอุปกรณ์พร้อมจำนวนพนักงานที่มีสิทธิ์
   */
  async findWithEmployeeCount(companyId) {
    const devices = await this.findByCompany(companyId);

    return devices.map((device) => {
      const employeeIds = this.parseEmployeeIds(device.employeeId);
      return {
        ...device,
        employee_count: employeeIds.length,
        is_open_access: employeeIds.length === 0,
      };
    });
  }

  /** -----------------------------------------------------------------------
   * เพิ่มพนักงานเข้าสิทธิ์อุปกรณ์
   */
  async addEmployee(deviceId, employeeId) {
    const device = await this.findById(deviceId);
    if (!device) return false;

    const employeeIds = this.parseEmployeeIds(device.employeeId);

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
      deviceId,
    ]);
    return true;
  }

  /** -----------------------------------------------------------------------
   * ลบพนักงานออกจากสิทธิ์อุปกรณ์
   */
  async removeEmployee(deviceId, employeeId) {
    const device = await this.findById(deviceId);
    if (!device) return false;

    let employeeIds = this.parseEmployeeIds(device.employeeId);
    employeeIds = employeeIds.filter((id) => id !== parseInt(employeeId, 10));

    const sql = `
      UPDATE ${this.tableName} 
      SET employeeId = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await this.pool.execute(sql, [
      this.stringifyEmployeeIds(employeeIds),
      deviceId,
    ]);
    return true;
  }

  /** -----------------------------------------------------------------------
   * อัพเดท Last Heartbeat (สำหรับ monitoring)
   */
  async updateHeartbeat(hwid) {
    const sql = `
      UPDATE ${this.tableName}
      SET last_heartbeat = NOW(), updated_at = NOW()
      WHERE hwid = ?
    `;
    const [result] = await this.pool.execute(sql, [hwid]);
    return result.affectedRows > 0;
  }

  /** -----------------------------------------------------------------------
   * ค้นหาอุปกรณ์ที่ Offline (ไม่มี heartbeat นานเกิน X นาที)
   */
  async findOfflineDevices(companyId, minutesThreshold = 5) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE company_id = ?
        AND status = ?
        AND (
          last_heartbeat IS NULL 
          OR last_heartbeat < DATE_SUB(NOW(), INTERVAL ? MINUTE)
        )
      ORDER BY device_name ASC
    `;
    return this.query(sql, [companyId, DEVICE_STATUS.ACTIVE, minutesThreshold]);
  }

  /** -----------------------------------------------------------------------
   * อัพเดทสถานะอุปกรณ์
   */
  async updateStatus(deviceId, status) {
    return this.update(deviceId, { status });
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่า HWID ซ้ำหรือไม่
   */
  async isHwidExists(hwid, excludeId = null) {
    let sql = `
      SELECT COUNT(*) as total 
      FROM ${this.tableName}
      WHERE hwid = ?
    `;
    const params = [hwid];

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    const rows = await this.query(sql, params);
    return rows[0].total > 0;
  }

  /** -----------------------------------------------------------------------
   * ค้นหาอุปกรณ์ตามประเภท
   */
  async findByType(companyId, deviceType) {
    return this.findAll({
      where: {
        company_id: companyId,
        device_type: deviceType,
      },
      orderBy: "device_name ASC",
    });
  }

  /** -----------------------------------------------------------------------
   * ค้นหาอุปกรณ์ตามตำแหน่ง
   */
  async findByLocation(companyId, locationName) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE company_id = ? AND location_name LIKE ?
      ORDER BY device_name ASC
    `;
    return this.query(sql, [companyId, `%${locationName}%`]);
  }
}

module.exports = new DevIOModel();
