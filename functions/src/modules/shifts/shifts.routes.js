/**
 * /src/modules/shifts/shifts.routes.js
 *
 * Shifts Routes
 * กำหนดเส้นทาง API สำหรับการจัดการกะการทำงาน
 */

const express = require("express");
const router = express.Router();

// import controller and middleware
const ShiftController = require("./shifts.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  validate,
  shiftsSchemas,
} = require("../../middleware/validate.middleware");

// กำหนดเส้นทาง API ที่นี้
router
  .get(
    "/",
    authenticate, // ตรวจสอบการยืนยันตัวตน
    ShiftController.getAllShifts // ดึงกะการทำงานทั้งหมด
  )
  .post(
    "/",
    authenticate, // ตรวจสอบการยืนยันตัวตน
    validate(shiftsSchemas.create), // ตรวจสอบความถูกต้องของข้อมูลที่ส่งมา
    ShiftController.createShift // สร้างกะการทำงานใหม่
  )
  .patch(
    "/:id",
    authenticate, // ตรวจสอบการยืนยันตัวตน
    validate(shiftsSchemas.update), // ตรวจสอบความถูกต้องของข้อมูลที่ส่งมา
    ShiftController.updateShift // อัปเดตกะการทำงาน
  )
  .post(
    "/assign",
    authenticate, // ตรวจสอบการยืนยันตัวตน
    validate(shiftsSchemas.assign), // ตรวจสอบความถูกต้องของข้อมูลที่ส่งมา
    ShiftController.assignShiftToEmployee // กำหนดกะการทำงานให้พนักงาน
  )
  .delete(
    "/:id",
    authenticate, // ตรวจสอบการยืนยันตัวตน
    ShiftController.deleteShift // ลบกะการทำงาน
  );

module.exports = router;
