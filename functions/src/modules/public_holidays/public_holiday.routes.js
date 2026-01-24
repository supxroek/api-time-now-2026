const express = require("express");
const publicHolidayController = require("./public_holiday.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Public Holiday Routes
router
  // Endpoint: /api/public-holidays - จัดการวันหยุดราชการ
  .route("/")
  // Endpoint: /api/public-holidays - ดึงรายชื่อวันหยุดราชการทั้งหมด
  .get(
    restrictTo("super_admin", "admin", "manager"),
    publicHolidayController.getAll,
  );

router
  // Endpoint: /api/public-holidays/:id - จัดการวันหยุดราชการรายบุคคล
  .route("/:id")
  // Endpoint: /api/public-holidays/:id - อัปเดตข้อมูลวันหยุดราชการ
  .patch(restrictTo("super_admin", "admin"), publicHolidayController.update);

module.exports = router;
