/**
 * /src/modules/devices/devices.model.js
 *
 * Devices Model
 * จัดการการเชื่อมต่อฐานข้อมูลสำหรับระบบอุปกรณ์ (devIO)
 */

const pool = require("../../config/database");

// Model Class
class DevicesModel {
  // ==================== Query Methods ====================

  /**
   * ดึงรายการอุปกรณ์ทั้งหมดของบริษัท
   * @param {number} companyId - รหัสบริษัท
   * @returns {Promise<Array>} รายการอุปกรณ์
   */
  async findAllByCompany(companyId) {
    const [rows] = await pool.query(
      `SELECT id, name, locationURL, HWID, Passcode, employeeId, companyId, created_at
       FROM devIO
       WHERE companyId = ?
       ORDER BY created_at DESC`,
      [companyId]
    );
    return rows;
  }

  /**
   * ดึงข้อมูลอุปกรณ์ตาม ID
   * @param {number} deviceId - รหัสอุปกรณ์
   * @param {number} companyId - รหัสบริษัท
   * @returns {Promise<Object|null>} ข้อมูลอุปกรณ์
   */
  async findById(deviceId, companyId) {
    const [rows] = await pool.query(
      `SELECT id, name, locationURL, HWID, Passcode, employeeId, companyId, created_at
       FROM devIO
       WHERE id = ? AND companyId = ?
       LIMIT 1`,
      [deviceId, companyId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * ดึงข้อมูลอุปกรณ์ตาม HWID
   * @param {string} hwid - Hardware ID
   * @param {number} companyId - รหัสบริษัท
   * @returns {Promise<Object|null>} ข้อมูลอุปกรณ์
   */
  async findByHWID(hwid, companyId) {
    const [rows] = await pool.query(
      `SELECT id, name, locationURL, HWID, Passcode, employeeId, companyId, created_at
       FROM devIO
       WHERE HWID = ? AND companyId = ?
       LIMIT 1`,
      [hwid, companyId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * ตรวจสอบว่า HWID ซ้ำหรือไม่ (ทั้งระบบ)
   * @param {string} hwid - Hardware ID
   * @param {number|null} excludeId - ID ที่ต้องการยกเว้น (สำหรับการอัปเดต)
   * @returns {Promise<boolean>} true ถ้าซ้ำ
   */
  async isHWIDExists(hwid, excludeId = null) {
    let query = `SELECT id FROM devIO WHERE HWID = ?`;
    const params = [hwid];

    if (excludeId) {
      query += ` AND id != ?`;
      params.push(excludeId);
    }

    const [rows] = await pool.query(query, params);
    return rows.length > 0;
  }

  // ==================== Create Methods ====================

  /**
   * สร้างอุปกรณ์ใหม่
   * @param {Object} data - ข้อมูลอุปกรณ์
   * @returns {Promise<Object>} ข้อมูลอุปกรณ์ที่สร้าง
   */
  async create(data) {
    const { name, locationURL, hwid, passcode, employeeId, companyId } = data;

    // แปลง employeeId array เป็น JSON string
    const employeeIdJson =
      typeof employeeId === "string"
        ? employeeId
        : JSON.stringify(employeeId || []);

    const [result] = await pool.query(
      `INSERT INTO devIO (name, locationURL, HWID, Passcode, employeeId, companyId, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [name, locationURL, hwid, passcode, employeeIdJson, companyId]
    );

    return {
      id: result.insertId,
      name,
      locationURL,
      hwid,
      passcode,
      employeeId: employeeIdJson,
      companyId,
    };
  }

  // ==================== Update Methods ====================

  /**
   * อัปเดตข้อมูลอุปกรณ์
   * @param {number} deviceId - รหัสอุปกรณ์
   * @param {number} companyId - รหัสบริษัท
   * @param {Object} data - ข้อมูลที่ต้องการอัปเดต
   * @returns {Promise<boolean>} true ถ้าอัปเดตสำเร็จ
   */
  async update(deviceId, companyId, data) {
    const updates = [];
    const params = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      params.push(data.name);
    }

    if (data.locationURL !== undefined) {
      updates.push("locationURL = ?");
      params.push(data.locationURL);
    }

    if (data.hwid !== undefined) {
      updates.push("HWID = ?");
      params.push(data.hwid);
    }

    if (data.passcode !== undefined) {
      updates.push("Passcode = ?");
      params.push(data.passcode);
    }

    if (data.employeeId !== undefined) {
      const employeeIdJson =
        typeof data.employeeId === "string"
          ? data.employeeId
          : JSON.stringify(data.employeeId || []);
      updates.push("employeeId = ?");
      params.push(employeeIdJson);
    }

    if (updates.length === 0) {
      return false;
    }

    params.push(deviceId, companyId);

    const [result] = await pool.query(
      `UPDATE devIO SET ${updates.join(", ")} WHERE id = ? AND companyId = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  /**
   * อัปเดตรายชื่อพนักงานที่ผูกกับอุปกรณ์
   * @param {number} deviceId - รหัสอุปกรณ์
   * @param {number} companyId - รหัสบริษัท
   * @param {Array<number>} employeeIds - รายการรหัสพนักงาน
   * @returns {Promise<boolean>} true ถ้าอัปเดตสำเร็จ
   */
  async updateEmployees(deviceId, companyId, employeeIds) {
    const employeeIdJson = JSON.stringify(employeeIds || []);

    const [result] = await pool.query(
      `UPDATE devIO SET employeeId = ? WHERE id = ? AND companyId = ?`,
      [employeeIdJson, deviceId, companyId]
    );

    return result.affectedRows > 0;
  }

  // ==================== Delete Methods ====================

  /**
   * ลบอุปกรณ์
   * @param {number} deviceId - รหัสอุปกรณ์
   * @param {number} companyId - รหัสบริษัท
   * @returns {Promise<boolean>} true ถ้าลบสำเร็จ
   */
  async delete(deviceId, companyId) {
    const [result] = await pool.query(
      `DELETE FROM devIO WHERE id = ? AND companyId = ?`,
      [deviceId, companyId]
    );

    return result.affectedRows > 0;
  }

  // ==================== Sync/Verify Methods ====================

  /**
   * ตรวจสอบ HWID และ Passcode สำหรับการ sync
   * @param {string} hwid - Hardware ID
   * @param {string} passcode - รหัสผ่านอุปกรณ์
   * @returns {Promise<Object|null>} ข้อมูลอุปกรณ์ถ้าถูกต้อง
   */
  async verifyDevice(hwid, passcode) {
    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.locationURL, d.HWID, d.employeeId, d.companyId,
              c.name as companyName
       FROM devIO d
       LEFT JOIN companies c ON d.companyId = c.id
       WHERE d.HWID = ? AND d.Passcode = ?
       LIMIT 1`,
      [hwid, passcode]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * ดึงรายชื่อพนักงานที่ผูกกับอุปกรณ์
   * @param {number} deviceId - รหัสอุปกรณ์
   * @param {number} companyId - รหัสบริษัท
   * @returns {Promise<Array>} รายชื่อพนักงาน
   */
  async getDeviceEmployees(deviceId, companyId) {
    // ดึง employeeId จาก device
    const device = await this.findById(deviceId, companyId);
    if (!device) return [];

    // Parse employeeId JSON
    let employeeIds;
    try {
      employeeIds = JSON.parse(device.employeeId || "[]");
    } catch {
      employeeIds = [];
    }

    if (employeeIds.length === 0) return [];

    // ดึงข้อมูลพนักงาน
    const [rows] = await pool.query(
      `SELECT id, name, ID_or_Passport_Number, departmentId
       FROM employees
       WHERE id IN (?) AND companyId = ? AND resign_date IS NULL`,
      [employeeIds, companyId]
    );

    return rows;
  }
}

module.exports = new DevicesModel();
