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
  // Endpoint: /api/devices - ดึงรายชื่ออุปกรณ์ทั้งหมด + การค้นหา/กรอง + stats(บันทึกวันนี้/สำเร็จ/ล้มเหลว)
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

// =============================================================
// Access controls - การควบคุมการเข้าถึงอุปกรณ์
router
  // Endpoint: /api/devices/:id/access-controls - ดึงรายการสิทธิ์ของอุปกรณ์
  .get(
    "/:id/access-controls",
    restrictTo("super_admin", "admin", "manager"),
    deviceController.getAccessControls,
  )
  // Endpoint: /api/devices/:id/grant-access - อนุญาตการเข้าถึงอุปกรณ์
  .post(
    "/:id/grant-access",
    restrictTo("super_admin", "admin"),
    deviceController.grantAccess,
  )
  // Endpoint: /api/devices/:id/revoke-access - เพิกถอนการเข้าถึงอุปกรณ์
  .post(
    "/:id/revoke-access",
    restrictTo("super_admin", "admin"),
    deviceController.revokeAccess,
  );

module.exports = router;
