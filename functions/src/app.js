/**
 * /src/app.js
 *
 * Central Route Registry
 * รวบรวมและ Export Routes ทั้งหมด
 */

const express = require("express");
const router = express.Router();

// Import routes
const authRoutes = require("./modules/auth/auth.routes");
const employeeRoutes = require("./modules/employees/employee.routes");
const branchRoutes = require("./modules/branches/branch.routes");
const companyRoutes = require("./modules/companies/company.routes");
const publicHolidayRoutes = require("./modules/public_holidays/public_holiday.routes");
const departmentRoutes = require("./modules/departments/department.routes");
const deviceRoutes = require("./modules/devices/device.routes");
const shiftRoutes = require("./modules/shifts/shift.routes");
const shiftPatternRoutes = require("./modules/shift_patterns/shift_pattern.routes");
const rosterRoutes = require("./modules/rosters/roster.routes");
const otTemplateRoutes = require("./modules/ot_templates/ot_template.routes");
const attendanceLogRoutes = require("./modules/attendance_logs/attendance_log.routes");
const requestRoutes = require("./modules/requests/request.routes");

// API Version prefix
const API_VERSION = "/api";

/**
 * Mount routes
 */
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/employees`, employeeRoutes);
router.use(`${API_VERSION}/branches`, branchRoutes);
router.use(`${API_VERSION}/companies`, companyRoutes);
router.use(`${API_VERSION}/public-holidays`, publicHolidayRoutes);
router.use(`${API_VERSION}/departments`, departmentRoutes);
router.use(`${API_VERSION}/devices`, deviceRoutes);
router.use(`${API_VERSION}/shifts`, shiftRoutes);
router.use(`${API_VERSION}/shift-patterns`, shiftPatternRoutes);
router.use(`${API_VERSION}/rosters`, rosterRoutes);
router.use(`${API_VERSION}/ot-templates`, otTemplateRoutes);
router.use(`${API_VERSION}/attendance-logs`, attendanceLogRoutes);
router.use(`${API_VERSION}/requests`, requestRoutes);

/**
 * API Info route
 */

module.exports = router;
