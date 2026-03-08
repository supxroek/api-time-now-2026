const express = require("express");
const statsController = require("./stats.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/stats
  .route("/")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    statsController.getOverview,
  );

router
  // Endpoint: GET /api/v2/stats/reports/individual-summary
  .route("/reports/individual-summary")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    statsController.getIndividualSummary,
  );

router
  // Endpoint: GET /api/v2/stats/reports/employee-summary
  .route("/reports/employee-summary")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    statsController.getEmployeeSummary,
  );

router
  // Endpoint: GET /api/v2/stats/reports/daily-attendance
  .route("/reports/daily-attendance")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    statsController.getDailyAttendance,
  );

module.exports = router;
