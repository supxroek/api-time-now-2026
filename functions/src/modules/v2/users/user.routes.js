const express = require("express");
const userController = require("./user.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/users
  .route("/")
  .get(restrictTo("super_admin", "admin"), userController.getAll);

router
  // Endpoint: GET /api/v2/users/:id/role
  .route("/:id/role")
  .patch(restrictTo("super_admin", "admin"), userController.updateRole);

router
  // Endpoint: GET /api/v2/users/:id/status
  .route("/:id/status")
  .patch(restrictTo("super_admin", "admin"), userController.updateStatus);
module.exports = router;
