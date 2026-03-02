const express = require("express");
const controller = require("./time_record.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/time-records/overview
  .route("/overview")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getOverview);

router
  // Endpoint: GET /api/v2/time-records/employees/:employeeId/history
  .route("/employees/:employeeId/history")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    controller.getEmployeeHistory,
  );

module.exports = router;
