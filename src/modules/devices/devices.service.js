/**
 * /src/modules/devices/devices.service.js
 *
 * Devices Service
 * จัดการตรรกะทางธุรกิจ (business logic) ที่เกี่ยวกับอุปกรณ์
 */

// import database models and utilities
const DevicesModel = require("./devices.model");
const pool = require("../../config/database");

// Devices Service Class
class DevicesService {
  // ==================== Get Methods ====================

  /**
   * ดึงรายการอุปกรณ์ทั้งหมดของบริษัท
   * @param {number} companyId - รหัสบริษัท
   * @returns {Promise<Object>} รายการอุปกรณ์พร้อม parsed employeeId
   */
  async getAllDevices(companyId) {
    const devices = await DevicesModel.findAllByCompany(companyId);

    // Parse employeeId JSON และดึงข้อมูลพนักงาน
    const devicesWithEmployees = await Promise.all(
      devices.map(async (device) => {
        let employeeIds = [];
        try {
          employeeIds = JSON.parse(device.employeeId || "[]");
        } catch {
          employeeIds = [];
        }

        const employees = await DevicesModel.getDeviceEmployees(
          device.id,
          companyId
        );

        return {
          id: device.id,
          name: device.name,
          locationURL: device.locationURL,
          hwid: device.HWID,
          passcode: device.Passcode,
          employeeIds: employeeIds,
          employeeCount: employees.length,
          employees: employees,
          companyId: device.companyId,
          createdAt: device.created_at,
        };
      })
    );

    return {
      devices: devicesWithEmployees,
      total: devicesWithEmployees.length,
    };
  }

  /**
   * ดึงข้อมูลอุปกรณ์ตาม ID
   * @param {number} deviceId - รหัสอุปกรณ์
   * @param {number} companyId - รหัสบริษัท
   * @returns {Promise<Object>} ข้อมูลอุปกรณ์
   */
  async getDeviceById(deviceId, companyId) {
    const device = await DevicesModel.findById(deviceId, companyId);

    if (!device) {
      const error = new Error("ไม่พบอุปกรณ์");
      error.statusCode = 404;
      throw error;
    }

    let employeeIds = [];
    try {
      employeeIds = JSON.parse(device.employeeId || "[]");
    } catch {
      employeeIds = [];
    }

    const employees = await DevicesModel.getDeviceEmployees(
      deviceId,
      companyId
    );

    return {
      id: device.id,
      name: device.name,
      locationURL: device.locationURL,
      hwid: device.HWID,
      passcode: device.Passcode,
      employeeIds: employeeIds,
      employees: employees,
      companyId: device.companyId,
      createdAt: device.created_at,
    };
  }

  // ==================== Create Methods ====================

  /**
   * สร้างอุปกรณ์ใหม่
   * @param {number} companyId - รหัสบริษัท
   * @param {Object} deviceData - ข้อมูลอุปกรณ์
   * @returns {Promise<Object>} ข้อมูลอุปกรณ์ที่สร้าง
   */
  async createDevice(companyId, deviceData) {
    const { name, locationURL, hwid, passcode, employeeIds } = deviceData;

    // ตรวจสอบ HWID ซ้ำ
    const isHWIDExists = await DevicesModel.isHWIDExists(hwid);
    if (isHWIDExists) {
      const error = new Error("HWID นี้ถูกใช้งานแล้ว");
      error.statusCode = 409;
      throw error;
    }

    // ตรวจสอบความถูกต้องของ employeeIds (ถ้ามี)
    if (employeeIds && employeeIds.length > 0) {
      await this._validateEmployeeIds(employeeIds, companyId);
    }

    // สร้างอุปกรณ์
    const newDevice = await DevicesModel.create({
      name,
      locationURL,
      hwid,
      passcode,
      employeeId: employeeIds || [],
      companyId,
    });

    return {
      message: "สร้างอุปกรณ์สำเร็จ",
      device: {
        id: newDevice.id,
        name: newDevice.name,
        locationURL: newDevice.locationURL,
        hwid: newDevice.hwid,
        employeeIds: employeeIds || [],
        companyId: newDevice.companyId,
      },
    };
  }

  // ==================== Update Methods ====================

  /**
   * อัปเดตข้อมูลอุปกรณ์
   * @param {number} deviceId - รหัสอุปกรณ์
   * @param {number} companyId - รหัสบริษัท
   * @param {Object} updateData - ข้อมูลที่ต้องการอัปเดต
   * @returns {Promise<Object>} ผลลัพธ์การอัปเดต
   */
  async updateDevice(deviceId, companyId, updateData) {
    // ตรวจสอบว่าอุปกรณ์มีอยู่
    const device = await DevicesModel.findById(deviceId, companyId);
    if (!device) {
      const error = new Error("ไม่พบอุปกรณ์");
      error.statusCode = 404;
      throw error;
    }

    // ตรวจสอบ HWID ซ้ำ (ถ้าเปลี่ยน)
    if (updateData.hwid && updateData.hwid !== device.HWID) {
      const isHWIDExists = await DevicesModel.isHWIDExists(
        updateData.hwid,
        deviceId
      );
      if (isHWIDExists) {
        const error = new Error("HWID นี้ถูกใช้งานแล้ว");
        error.statusCode = 409;
        throw error;
      }
    }

    // ตรวจสอบความถูกต้องของ employeeIds (ถ้ามี)
    if (updateData.employeeIds && updateData.employeeIds.length > 0) {
      await this._validateEmployeeIds(updateData.employeeIds, companyId);
    }

    // เตรียมข้อมูลสำหรับอัปเดต
    const dataToUpdate = {};
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.locationURL !== undefined)
      dataToUpdate.locationURL = updateData.locationURL;
    if (updateData.hwid !== undefined) dataToUpdate.hwid = updateData.hwid;
    if (updateData.passcode !== undefined)
      dataToUpdate.passcode = updateData.passcode;
    if (updateData.employeeIds !== undefined)
      dataToUpdate.employeeId = updateData.employeeIds;

    // อัปเดต
    const updated = await DevicesModel.update(
      deviceId,
      companyId,
      dataToUpdate
    );

    if (!updated) {
      const error = new Error("ไม่สามารถอัปเดตอุปกรณ์ได้");
      error.statusCode = 500;
      throw error;
    }

    return {
      message: "อัปเดตอุปกรณ์สำเร็จ",
      deviceId: deviceId,
    };
  }

  // ==================== Sync Methods ====================

  /**
   * ซิงค์ข้อมูลอุปกรณ์ (สำหรับเครื่อง Time Attendance)
   * @param {Object} syncData - ข้อมูลสำหรับ sync
   * @returns {Promise<Object>} ข้อมูลสำหรับอุปกรณ์
   */
  async syncDevices(syncData) {
    const { hwid, passcode } = syncData;

    // ตรวจสอบ HWID และ Passcode
    const device = await DevicesModel.verifyDevice(hwid, passcode);

    if (!device) {
      const error = new Error("HWID หรือ Passcode ไม่ถูกต้อง");
      error.statusCode = 401;
      throw error;
    }

    // Parse employeeId
    let employeeIds = [];
    try {
      employeeIds = JSON.parse(device.employeeId || "[]");
    } catch {
      employeeIds = [];
    }

    // ดึงข้อมูลพนักงานพร้อมรายละเอียด
    const employees = await this._getEmployeesForSync(
      employeeIds,
      device.companyId
    );

    return {
      device: {
        id: device.id,
        name: device.name,
        locationURL: device.locationURL,
        companyId: device.companyId,
        companyName: device.companyName,
      },
      employees: employees,
      syncedAt: new Date().toISOString(),
    };
  }

  // ==================== Helper Methods ====================

  /**
   * ตรวจสอบความถูกต้องของรายการ employeeIds
   * @param {Array<number>} employeeIds - รายการรหัสพนักงาน
   * @param {number} companyId - รหัสบริษัท
   * @returns {Promise<void>}
   */
  async _validateEmployeeIds(employeeIds, companyId) {
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) return;

    const [rows] = await pool.query(
      `SELECT id FROM employees 
       WHERE id IN (?) AND companyId = ? AND resign_date IS NULL`,
      [employeeIds, companyId]
    );

    const validIds = new Set(rows.map((r) => r.id));
    const invalidIds = employeeIds.filter((id) => !validIds.has(id));

    if (invalidIds.length > 0) {
      const error = new Error(
        `พนักงานไม่ถูกต้องหรือไม่อยู่ในบริษัท: ${invalidIds.join(", ")}`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  /**
   * ดึงข้อมูลพนักงานสำหรับ sync ไปยังอุปกรณ์
   * @param {Array<number>} employeeIds - รายการรหัสพนักงาน
   * @param {number} companyId - รหัสบริษัท
   * @returns {Promise<Array>} รายชื่อพนักงาน
   */
  async _getEmployeesForSync(employeeIds, companyId) {
    if (employeeIds.length === 0) return [];

    const [rows] = await pool.query(
      `SELECT e.id, e.name, e.ID_or_Passport_Number as idNumber,
              d.departmentName
       FROM employees e
       LEFT JOIN department d ON e.departmentId = d.id
       WHERE e.id IN (?) AND e.companyId = ? AND e.resign_date IS NULL
       ORDER BY e.name ASC`,
      [employeeIds, companyId]
    );

    return rows.map((emp) => ({
      id: emp.id,
      name: emp.name,
      idNumber: emp.idNumber,
      department: emp.departmentName || null,
    }));
  }
}

module.exports = new DevicesService();
