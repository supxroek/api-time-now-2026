const express = require("express");
const controller = require("./ot_template.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// OT Template Routes
router
  // Endpoint: /api/ot-templates - จัดการแม่แบบการทำงานล่วงเวลา
  .route("/")
  // Endpoint: /api/ot-templates - ดึงรายชื่อแม่แบบการทำงานล่วงเวลาทั้งหมด
  .get(restrictTo("super_admin", "admin", "manager"), controller.getAll)
  // Endpoint: /api/ot-templates - สร้างแม่แบบการทำงานล่วงเวลาใหม่
  .post(restrictTo("super_admin", "admin"), controller.create);

router
  // Endpoint: /api/ot-templates/:id - จัดการแม่แบบการทำงานล่วงเวลารายบุคคล
  .route("/:id")
  // Endpoint: /api/ot-templates/:id - ดึงข้อมูลแม่แบบการทำงานล่วงเวลารายบุคคล
  .get(restrictTo("super_admin", "admin", "manager"), controller.getOne)
  // Endpoint: /api/ot-templates/:id - อัปเดตข้อมูลแม่แบบการทำงานล่วงเวลารายบุคคล
  .patch(restrictTo("super_admin", "admin"), controller.update)
  // Endpoint: /api/ot-templates/:id - ลบแม่แบบการทำงานล่วงเวลารายบุคคล
  .delete(restrictTo("super_admin", "admin"), controller.delete);

router
  // Endpoint: /api/ot-templates/deleted/list - ดึงรายชื่อแม่แบบการทำงานล่วงเวลาที่ถูกลบแบบ soft delete
  .get(
    "/deleted/list",
    restrictTo("super_admin", "admin", "manager"),
    controller.getDeletedTemplates,
  )
  // Endpoint: /api/ot-templates/soft-delete/:id - ลบแม่แบบการทำงานล่วงเวลารายบุคคล (soft delete)
  .delete(
    "/soft-delete/:id",
    restrictTo("super_admin", "admin"),
    controller.softDelete,
  )
  // Endpoint: /api/ot-templates/restore/:id - กู้คืนแม่แบบการทำงานล่วงเวลาที่ถูกลบแบบ soft delete
  .patch(
    "/restore/:id",
    restrictTo("super_admin", "admin"),
    controller.restore,
  );

module.exports = router;
