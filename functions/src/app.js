/**
 * /src/app.js
 *
 * Central Route Registry
 * รวบรวมและ Export Routes ทั้งหมด
 */

const express = require("express");
const router = express.Router();

// Import routes
const authRoutes = require("./modules/v1/auth/auth.routes");
const employeeRoutes = require("./modules/v1/employees/employee.routes");
const branchRoutes = require("./modules/v1/branches/branch.routes");
const companyRoutes = require("./modules/v1/companies/company.routes");
const publicHolidayRoutes = require("./modules/v1/public_holidays/public_holiday.routes");
const departmentRoutes = require("./modules/v1/departments/department.routes");
const deviceRoutes = require("./modules/v1/devices/device.routes");
const shiftRoutes = require("./modules/v1/shifts/shift.routes");
const shiftPatternRoutes = require("./modules/v1/shift_patterns/shift_pattern.routes");
const rosterRoutes = require("./modules/v1/rosters/roster.routes");
const otTemplateRoutes = require("./modules/v1/ot_templates/ot_template.routes");
const attendanceLogRoutes = require("./modules/v1/attendance_logs/attendance_log.routes");
const requestRoutes = require("./modules/v1/requests/request.routes");
const auditTrailRoutes = require("./modules/v1/audit_trail/audit_trail.routes");
const companySettingRoutes = require("./modules/v1/comapny_settings/comapny_settings.routes");
const dashboardRoutes = require("./modules/v1/dashboard/dashboard.routes");
const userRoutes = require("./modules/v1/users/user.routes");
const rosterManageRoutes = require("./modules/v1/roster_manage/roster_manage.routes");
const leaveHubIntegrationRoutes = require("./modules/v1/leaveHubIntegration/leaveHubIntegration.routes");
const dayResolutionRoutes = require("./modules/v1/day_resolution/day_resolution.routes");

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
router.use(`${API_VERSION}/audit-trails`, auditTrailRoutes);
router.use(`${API_VERSION}/company-settings`, companySettingRoutes);
router.use(`${API_VERSION}/dashboard`, dashboardRoutes);
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/roster-manage`, rosterManageRoutes);
router.use(`${API_VERSION}/leave-hub-integration`, leaveHubIntegrationRoutes);
router.use(`${API_VERSION}/day-resolution`, dayResolutionRoutes);

/**
 * API Info route
 */

module.exports = router;
