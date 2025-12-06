/**
 * /src/modules/devices/devices.controller.js
 *
 * Devices Controller
 * จัดการคำขอ (requests) ที่เกี่ยวกับอุปกรณ์
 */

// import devices service and utilities
const DevicesService = require("./devices.service");

// Devices Class
class DevicesController {
  /**
   * GET /api/devices/
   * ดึงรายการอุปกรณ์ทั้งหมดของบริษัท
   */
  async getAllDevices(req, res, next) {
    try {
      const companyId = req.user.company_id;

      const result = await DevicesService.getAllDevices(companyId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/devices/:id
   * ดึงข้อมูลอุปกรณ์ตาม ID
   */
  async getDeviceById(req, res, next) {
    try {
      const companyId = req.user.company_id;
      const deviceId = Number.parseInt(req.params.id);

      const result = await DevicesService.getDeviceById(deviceId, companyId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/devices/
   * สร้างอุปกรณ์ใหม่
   */
  async createDevice(req, res, next) {
    try {
      const companyId = req.user.company_id;
      const deviceData = {
        name: req.body.name,
        locationURL: req.body.locationURL,
        hwid: req.body.hwid,
        passcode: req.body.passcode,
        employeeIds: req.body.employeeIds || [],
      };

      const result = await DevicesService.createDevice(companyId, deviceData);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/devices/:id
   * อัปเดตข้อมูลอุปกรณ์
   */
  async updateDevice(req, res, next) {
    try {
      const companyId = req.user.company_id;
      const deviceId = Number.parseInt(req.params.id);

      // รับเฉพาะ field ที่ส่งมา
      const updateData = {};
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.locationURL !== undefined)
        updateData.locationURL = req.body.locationURL;
      if (req.body.hwid !== undefined) updateData.hwid = req.body.hwid;
      if (req.body.passcode !== undefined)
        updateData.passcode = req.body.passcode;
      if (req.body.employeeIds !== undefined)
        updateData.employeeIds = req.body.employeeIds;

      const result = await DevicesService.updateDevice(
        deviceId,
        companyId,
        updateData
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/devices/sync
   * ซิงค์ข้อมูลอุปกรณ์ (สำหรับเครื่อง Time Attendance)
   */
  async syncDevices(req, res, next) {
    try {
      const syncData = {
        hwid: req.body.hwid,
        passcode: req.body.passcode,
      };

      const result = await DevicesService.syncDevices(syncData);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DevicesController();
