const express = require("express");
const controller = require("./audit_trail.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/audit-trails/overview
  .route("/overview")
  .get(restrictTo("super_admin", "admin"), controller.getOverview);

router
  .route("/stats")
  .get(restrictTo("super_admin", "admin"), controller.getStats);

router
  // Endpoint: GET /api/v2/audit-trails
  .route("/")
  .get(restrictTo("super_admin", "admin"), controller.getList);

router
  // Endpoint: GET /api/v2/audit-trails/:id
  .route("/:id")
  .get(restrictTo("super_admin", "admin"), controller.getOne);

module.exports = router;
