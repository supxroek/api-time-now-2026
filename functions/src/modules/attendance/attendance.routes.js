/**
 * /src/modules/attendance/attendance.routes.js
 *
 * Attendance Routes
 * จัดการเส้นทาง API ที่เกี่ยวกับการบันทึกเวลาการทำงาน
 */

const express = require("express");
const router = express.Router();

// import attendance controller and middleware
const AttendanceController = require("./attendance.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  validate,
  attendanceSchemas,
} = require("../../middleware/validate.middleware");

// ==================== Mobile/Web Application Routes ====================
router
  // Check-in: บันทึกเวลาเข้างาน (ไม่ต้อง validate body เพราะไม่มี input)
  .post("/check-in", authenticate, AttendanceController.checkIn)

  // Check-out: บันทึกเวลาออกงาน (ไม่ต้อง validate body เพราะไม่มี input)
  .post("/check-out", authenticate, AttendanceController.checkOut)

  // Break Start: บันทึกเวลาเริ่มพัก (ไม่ต้อง validate body เพราะไม่มี input)
  .post("/break/start", authenticate, AttendanceController.breakStart)

  // Break End: บันทึกเวลาสิ้นสุดการพัก (ไม่ต้อง validate body เพราะไม่มี input)
  .post("/break/end", authenticate, AttendanceController.breakEnd)

  // Today: ดึงข้อมูลการบันทึกเวลางานวันนี้ (สำหรับแสดงสถานะปุ่มใน Frontend)
  .get("/today", authenticate, AttendanceController.getTodayAttendance);

// ==================== Admin/Manager/HR Routes ====================
router
  // History: ดึงประวัติการบันทึกเวลางาน
  .get(
    "/history",
    authenticate,
    validate(attendanceSchemas.getHistory, "query"),
    AttendanceController.getAttendanceHistory
  )

  // Summary: ดึงสรุปการบันทึกเวลางาน (รายเดือน)
  .get(
    "/summary",
    authenticate,
    validate(attendanceSchemas.getSummary, "query"),
    AttendanceController.getAttendanceSummary
  );

module.exports = router;
