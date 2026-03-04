const express = require("express");
const controller = require("./roster.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  .route("/overview")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getOverview);

module.exports = router;
