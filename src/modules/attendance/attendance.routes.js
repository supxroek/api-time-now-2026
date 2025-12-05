/**
 * /src/modules/attendance/attendance.routes.js
 *
 * Attendance Routes
 * จัดการเส้นทาง API ที่เกี่ยวกับการบันทึกเวลาการทำงาน
 */

const express = require("express");
const router = express.Router();

// import attendance controller and middleware
const attendanceController = require("./attendance.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  validate,
  attendanceSchemas,
} = require("../../middleware/validate.middleware");

// ==================== Mobile/Web Application Routes ====================
router
  // Check-in: บันทึกเวลาเข้างาน (ไม่ต้อง validate body เพราะไม่มี input)
  .post("/check-in", authenticate, attendanceController.checkIn)

  // Check-out: บันทึกเวลาออกงาน (ไม่ต้อง validate body เพราะไม่มี input)
  .post("/check-out", authenticate, attendanceController.checkOut)

  // Break Start: บันทึกเวลาเริ่มพัก (ไม่ต้อง validate body เพราะไม่มี input)
  .post("/break/start", authenticate, attendanceController.breakStart)

  // Break End: บันทึกเวลาสิ้นสุดการพัก (ไม่ต้อง validate body เพราะไม่มี input)
  .post("/break/end", authenticate, attendanceController.breakEnd)

  // Today: ดึงข้อมูลการบันทึกเวลางานวันนี้ (สำหรับแสดงสถานะปุ่มใน Frontend)
  .get("/today", authenticate, attendanceController.getTodayAttendance);

// ==================== Admin/Manager/HR Routes ====================
router
  // History: ดึงประวัติการบันทึกเวลางาน
  .get(
    "/history",
    authenticate,
    validate(attendanceSchemas.getHistory, "query"),
    attendanceController.getAttendanceHistory
  )

  // Summary: ดึงสรุปการบันทึกเวลางาน (รายเดือน)
  .get(
    "/summary",
    authenticate,
    validate(attendanceSchemas.getSummary, "query"),
    attendanceController.getAttendanceSummary
  );

module.exports = router;
