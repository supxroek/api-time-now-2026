const express = require("express");
const controller = require("./dashboard.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Dashboard Routes
router
  .route("/overview")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getOverview);

module.exports = router;
