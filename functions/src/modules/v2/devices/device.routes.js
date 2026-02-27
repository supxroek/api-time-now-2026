const express = require("express");
const deviceController = require("./device.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
    // Endpoint: GET /api/v2/devices
  .route("/")
  .get(restrictTo("super_admin", "admin", "manager"), deviceController.getAll)
  .post(restrictTo("super_admin", "admin"), deviceController.create);

router
    // Endpoint: GET /api/v2/devices/:id
  .route("/:id")
  .get(restrictTo("super_admin", "admin", "manager"), deviceController.getOne)
  .patch(restrictTo("super_admin", "admin"), deviceController.update)
  .delete(restrictTo("super_admin", "admin"), deviceController.delete);

router
    // Endpoint: GET /api/v2/devices/:id/access-controls
  .route("/:id/access-controls")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    deviceController.getAccessControls,
  )
  .post(restrictTo("super_admin", "admin"), deviceController.addAccessControl)
  .delete(
    restrictTo("super_admin", "admin"),
    deviceController.removeAccessControl,
  );

module.exports = router;
