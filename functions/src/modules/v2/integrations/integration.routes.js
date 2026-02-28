const express = require("express");
const controller = require("./integration.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/integrations/leavehub
  .route("/leavehub")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    controller.getLeaveHubStatus,
  );

router
  // Endpoint: POST /api/v2/integrations/leavehub/connect
  .route("/leavehub/connect")
  .post(restrictTo("super_admin", "admin"), controller.connectLeaveHub);

router
  // Endpoint: POST /api/v2/integrations/leavehub/disconnect
  .route("/leavehub/disconnect")
  .post(restrictTo("super_admin", "admin"), controller.disconnectLeaveHub);

router
  // Endpoint: POST /api/v2/integrations/leavehub/sync
  .route("/leavehub/sync")
  .post(restrictTo("super_admin", "admin", "manager"), controller.syncLeaveHub);

module.exports = router;
