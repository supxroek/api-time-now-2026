const express = require("express");
const controller = require("./leaveHubIntegration.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  .route("/connect")
  .post(restrictTo("super_admin", "admin"), controller.connectLeaveHub);

router
  .route("/sync")
  .post(restrictTo("super_admin", "admin", "manager"), controller.syncLeaveHub);

router
  .route("/disconnect")
  .post(restrictTo("super_admin", "admin"), controller.disconnectLeaveHub);

router
  .route("/roster-context")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    controller.getRosterContext,
  );

module.exports = router;
