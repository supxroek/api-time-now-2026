const express = require("express");
const deviceController = require("./device.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Device Routes
router
  // Endpoint: /api/devices - จัดการอุปกรณ์
  .route("/")
  // Endpoint: /api/devices - ดึงรายชื่ออุปกรณ์ทั้งหมด
  .get(restrictTo("super_admin", "admin", "manager"), deviceController.getAll)
  // Endpoint: /api/devices - สร้างอุปกรณ์ใหม่
  .post(restrictTo("super_admin", "admin"), deviceController.create);

router
  // Endpoint: /api/devices/:id - จัดการอุปกรณ์รายบุคคล
  .route("/:id")
  // Endpoint: /api/devices/:id - ดึงข้อมูลอุปกรณ์รายบุคคล
  .get(restrictTo("super_admin", "admin", "manager"), deviceController.getOne)
  // Endpoint: /api/devices/:id - อัปเดตข้อมูลอุปกรณ์รายบุคคล
  .patch(restrictTo("super_admin", "admin"), deviceController.update)
  // Endpoint: /api/devices/:id - ลบอุปกรณ์รายบุคคล
  .delete(restrictTo("super_admin", "admin"), deviceController.delete);

// =============================================================
// เส้นทางพิเศษ
router
  // Endpoint: /api/devices/deleted/list - ดึงรายชื่ออุปกรณ์ที่ถูกลบทั้งหมด (soft deleted)
  .get(
    "/deleted/list",
    restrictTo("super_admin", "admin", "manager"),
    deviceController.getDeletedDevices,
  )
  // Endpoint: /api/devices/soft-delete/:id - ลบอุปกรณ์รายบุคคล (soft delete)
  .delete(
    "/soft-delete/:id",
    restrictTo("super_admin", "admin"),
    deviceController.softDelete,
  )
  // Endpoint: /api/devices/restore/:id - กู้คืนอุปกรณ์รายบุคคล
  .patch(
    "/restore/:id",
    restrictTo("super_admin", "admin"),
    deviceController.restore,
  );

module.exports = router;
