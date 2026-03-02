const express = require("express");
const controller = require("./day_resolution.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/day-resolution
  // ตัวอย่างการใช้งาน: GET /api/v2/day-resolution?date=2024-06-01
  // Enpoint นี้จะดึงข้อมูล resolution ของพนักงานทุกคนในวันที่ระบุ โดยใช้ query parameter "date" ในรูปแบบ YYYY-MM-DD
  .route("/")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    controller.getDailySnapshots,
  );

router
  // Endpoint: GET /api/v2/day-resolution/employee/:employeeId
  // ตัวอย่างการใช้งาน: GET /api/v2/day-resolution/employee/12345?date=2024-06-01
  // Endpoint นี้จะดึงข้อมูล resolution ของพนักงานคนเดียวในวันที่ระบุ โดยใช้ path parameter "employeeId" และ query parameter "date" ในรูปแบบ YYYY-MM-DD
  .route("/employee/:employeeId")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    controller.getEmployeeResolution,
  );

router
  // Endpoint: POST /api/v2/day-resolution/jit-snapshot
  // ตัวอย่างการใช้งาน: POST /api/v2/day-resolution/jit-snapshot
  // Body:
  // {
  //   "employee_id": "12345",
  //   "date": "2024-06-01",
  //   "snapshot_data": { ... }
  // }
  // Endpoint นี้จะสร้าง snapshot แบบ JIT (Just-In-Time) สำหรับพนักงานคนเดียวในวันที่ระบุ โดยรับข้อมูลผ่าน request body ซึ่งต้องมี employee_id, date และ snapshot_data
  // snapshot_data จะเป็นข้อมูลรายละเอียดของ resolution ที่ต้องการบันทึก ซึ่งสามารถมีโครงสร้างได้ตามที่ระบบกำหนด
  .route("/jit-snapshot")
  .post(
    restrictTo("super_admin", "admin", "manager"),
    controller.createJitSnapshot,
  );

module.exports = router;
