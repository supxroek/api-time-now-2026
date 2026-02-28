/**
 * /src/app.js
 *
 * Central Route Registry
 * รวบรวมและ Export Routes ทั้งหมด
 */

const express = require("express");
const router = express.Router();

// Import routes
// ===============================================================
// V1 Routes
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

// ===============================================================
// V2 Routes
const companyV2Routes = require("./modules/v2/companies/company.routes");
const departmentV2Routes = require("./modules/v2/departments/department.routes");
const employeeV2Routes = require("./modules/v2/employees/employee.routes");
const userV2Routes = require("./modules/v2/users/user.routes");
const deviceV2Routes = require("./modules/v2/devices/device.routes");
const otTemplateV2Routes = require("./modules/v2/ot_templates/ot_template.routes");
const shiftV2Routes = require("./modules/v2/shifts/shift.routes");
const requestV2Routes = require("./modules/v2/requests/request.routes");

// API Version prefix
const API_VERSION_V1 = "/api";
const API_VERSION_V2 = "/api/v2";

/**
 * Mount routes
 */
// ===============================================================
// V1 Routes
router.use(`${API_VERSION_V1}/auth`, authRoutes);
router.use(`${API_VERSION_V1}/employees`, employeeRoutes);
router.use(`${API_VERSION_V1}/branches`, branchRoutes);
router.use(`${API_VERSION_V1}/companies`, companyRoutes);
router.use(`${API_VERSION_V1}/public-holidays`, publicHolidayRoutes);
router.use(`${API_VERSION_V1}/departments`, departmentRoutes);
router.use(`${API_VERSION_V1}/devices`, deviceRoutes);
router.use(`${API_VERSION_V1}/shifts`, shiftRoutes);
router.use(`${API_VERSION_V1}/shift-patterns`, shiftPatternRoutes);
router.use(`${API_VERSION_V1}/rosters`, rosterRoutes);
router.use(`${API_VERSION_V1}/ot-templates`, otTemplateRoutes);
router.use(`${API_VERSION_V1}/attendance-logs`, attendanceLogRoutes);
router.use(`${API_VERSION_V1}/requests`, requestRoutes);
router.use(`${API_VERSION_V1}/audit-trails`, auditTrailRoutes);
router.use(`${API_VERSION_V1}/company-settings`, companySettingRoutes);
router.use(`${API_VERSION_V1}/dashboard`, dashboardRoutes);
router.use(`${API_VERSION_V1}/users`, userRoutes);
router.use(`${API_VERSION_V1}/roster-manage`, rosterManageRoutes);
router.use(
  `${API_VERSION_V1}/leave-hub-integration`,
  leaveHubIntegrationRoutes,
);
router.use(`${API_VERSION_V1}/day-resolution`, dayResolutionRoutes);

// ===============================================================
// V2 Routes
router.use(`${API_VERSION_V2}/companies`, companyV2Routes);
router.use(`${API_VERSION_V2}/departments`, departmentV2Routes);
router.use(`${API_VERSION_V2}/employees`, employeeV2Routes);
router.use(`${API_VERSION_V2}/users`, userV2Routes);
router.use(`${API_VERSION_V2}/devices`, deviceV2Routes);
router.use(`${API_VERSION_V2}/ot-templates`, otTemplateV2Routes);
router.use(`${API_VERSION_V2}/shifts`, shiftV2Routes);
router.use(`${API_VERSION_V2}/requests`, requestV2Routes);

/**
 * API Info route
 */

module.exports = router;
