const express = require("express");
const controller = require("./day_resolution.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    controller.getDailySnapshots,
  );

router
  .route("/employee/:employeeId")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    controller.getEmployeeResolution,
  );

module.exports = router;
