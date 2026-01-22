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
const departmentRoutes = require("./modules/departments/department.routes");
const deviceRoutes = require("./modules/devices/device.routes");

// API Version prefix
const API_VERSION = "/api";

/**
 * Mount routes
 */
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/employees`, employeeRoutes);
router.use(`${API_VERSION}/branches`, branchRoutes);
router.use(`${API_VERSION}/departments`, departmentRoutes);
router.use(`${API_VERSION}/devices`, deviceRoutes);

/**
 * API Info route
 */

module.exports = router;
