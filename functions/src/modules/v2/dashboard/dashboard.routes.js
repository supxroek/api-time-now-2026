const express = require("express");
const controller = require("./dashboard.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/dashboard/overview
  .route("/overview")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getOverview);

module.exports = router;
