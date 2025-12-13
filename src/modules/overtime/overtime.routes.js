/**
 * /src/modules/overtime/overtime.routes.js
 *
 * Overtime Routes
 * กำหนดเส้นทาง API สำหรับการจัดการชั่วโมงทำงานล่วงเวลา
 */

const express = require("express");
const router = express.Router();

// import controllers and middleware
const OvertimeController = require("./overtime.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  validate,
  overtimeSchemas,
} = require("../../middleware/validate.middleware");

// กำหนดเส้นทาง API ที่นี้
router
  .get(
    "/",
    authenticate, // ตรวจสอบการยืนยันตัวตน
    OvertimeController.getAllOvertimes
  )
  .post(
    "/",
    authenticate, // ตรวจสอบการยืนยันตัวตน
    validate(overtimeSchemas.create, "body"), // ตรวจสอบความถูกต้องของข้อมูล
    OvertimeController.createOvertime
  )
  .put(
    "/:id",
    authenticate,
    validate(overtimeSchemas.update, "body"),
    OvertimeController.updateOvertime
  )
  .delete("/:id", authenticate, OvertimeController.deleteOvertime);

module.exports = router;
