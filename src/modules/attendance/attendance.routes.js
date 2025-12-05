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
  // Check-in: บันทึกเวลาเข้างาน
  .post(
    "/check-in",
    authenticate,
    validate(attendanceSchemas.checkIn),
    attendanceController.checkIn
  )

  // Check-out: บันทึกเวลาออกงาน
  .post(
    "/check-out",
    authenticate,
    validate(attendanceSchemas.checkOut),
    attendanceController.checkOut
  )

  // Break Start: บันทึกเวลาเริ่มพัก
  .post(
    "/break/start",
    authenticate,
    validate(attendanceSchemas.breakStart),
    attendanceController.breakStart
  )

  // Break End: บันทึกเวลาสิ้นสุดการพัก
  .post(
    "/break/end",
    authenticate,
    validate(attendanceSchemas.breakEnd),
    attendanceController.breakEnd
  )

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
