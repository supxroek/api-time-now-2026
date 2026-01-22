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

// API Version prefix
const API_VERSION = "/api";

/**
 * Mount routes
 */
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/employees`, employeeRoutes);

/**
 * API Info route
 */

module.exports = router;
