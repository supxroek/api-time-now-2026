const express = require("express");
const reportController = require("./report.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/reports/individual-summary
  .route("/individual-summary")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    reportController.getIndividualSummary,
  );

router
  // Endpoint: GET /api/v2/reports/employee-summary
  .route("/employee-summary")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    reportController.getEmployeeSummary,
  );

router
  // Endpoint: GET /api/v2/reports/daily-attendance
  .route("/daily-attendance")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    reportController.getDailyAttendance,
  );

module.exports = router;
