/**
 * /src/modules/reports/report.routes.js
 *
 * Report Routes
 * กำหนด routes สำหรับ Reports API
 */

const express = require("express");
const router = express.Router();
const reportController = require("./report.controller");
const { authenticate } = require("../../middleware/auth.middleware");

// ทุก route ต้องผ่านการ authenticate
router.use(authenticate);

// GET /api/reports - ดึงข้อมูล report ทั้งหมด
router.get("/", reportController.getReportData);

// GET /api/reports/overview - ดึงข้อมูลสถิติภาพรวม
router.get("/overview", reportController.getOverviewStats);

// GET /api/reports/hours - ดึงข้อมูลสรุปชั่วโมง
router.get("/hours", reportController.getHourSummary);

// GET /api/reports/trend - ดึงข้อมูล trend การเข้างาน
router.get("/trend", reportController.getAttendanceTrend);

// GET /api/reports/departments - ดึงข้อมูลการกระจายตามแผนก
router.get("/departments", reportController.getDepartmentDistribution);

// GET /api/reports/monthly - ดึงข้อมูลสรุปรายเดือน
router.get("/monthly", reportController.getMonthlySummary);

// GET /api/reports/individual - ดึงข้อมูลสรุปรายบุคคล
router.get("/individual", reportController.getIndividualSummary);

module.exports = router;
