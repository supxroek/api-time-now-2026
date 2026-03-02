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

module.exports = router;
