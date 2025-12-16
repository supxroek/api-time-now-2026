/**
 * /src/modules/dashboard/dashboard.routes.js
 *
 * Dashboard Routes
 * กำหนดเส้นทาง API ที่เกี่ยวกับ Dashboard
 */

const express = require("express");
const router = express.Router();

const DashboardController = require("./dashboard.controller");
const { authenticate } = require("../../middleware/auth.middleware");

// ==================== Dashboard Routes ====================
router
  // Get all dashboard data
  .get("/", authenticate, DashboardController.getDashboardData)

  // Get today's stats
  .get("/stats", authenticate, DashboardController.getTodayStats)

  // Get today's attendance records with filtering
  .get(
    "/attendance",
    authenticate,
    DashboardController.getTodayAttendanceRecords
  )

  // Get recent activities
  .get("/activities", authenticate, DashboardController.getRecentActivities)

  // Get employee history
  .get(
    "/employee/:id/history",
    authenticate,
    DashboardController.getEmployeeHistory
  );

module.exports = router;
