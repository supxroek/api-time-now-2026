/**
 * /src/modules/devices/devices.routes.js
 *
 * Devices Routes
 * จัดการเส้นทาง API ที่เกี่ยวกับอุปกรณ์
 */

const express = require("express");
const router = express.Router();

// import devices controller and middleware
const DevicesController = require("./devices.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  validate,
  devicesSchemas,
} = require("../../middleware/validate.middleware");

// กำหนดเส้นทางที่นี้
router
  // GET /api/devices/ - ดึงรายการอุปกรณ์ทั้งหมด
  .get("/", authenticate, DevicesController.getAllDevices)

  // GET /api/devices/:id - ดึงข้อมูลอุปกรณ์ตาม ID
  .get("/:id", authenticate, DevicesController.getDeviceById)

  // POST /api/devices/ - เพิ่มอุปกรณ์ใหม่
  .post(
    "/",
    authenticate,
    validate(devicesSchemas.createDevice),
    DevicesController.createDevice
  )

  // POST /api/devices/sync - ซิงค์ข้อมูลอุปกรณ์ (สำหรับเครื่อง Time Attendance)
  .post(
    "/sync",
    validate(devicesSchemas.syncDevice),
    DevicesController.syncDevices
  )

  // PATCH /api/devices/:id - อัปเดตข้อมูลอุปกรณ์
  .patch(
    "/:id",
    authenticate,
    validate(devicesSchemas.updateDevice),
    DevicesController.updateDevice
  );

module.exports = router;
