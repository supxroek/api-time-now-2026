const express = require("express");
const shiftController = require("./shift.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/shifts
  .route("/")
  .get(restrictTo("super_admin", "admin", "manager"), shiftController.getAll)
  .post(restrictTo("super_admin", "admin"), shiftController.create);

router
  // Endpoint: GET /api/v2/shifts/:id
  .route("/:id")
  .get(restrictTo("super_admin", "admin", "manager"), shiftController.getOne)
  .patch(restrictTo("super_admin", "admin"), shiftController.update)
  .delete(restrictTo("super_admin", "admin"), shiftController.delete);

router
  // Endpoint: PATCH /api/v2/shifts/:id/restore
  .route("/:id/restore")
  .patch(restrictTo("super_admin", "admin"), shiftController.restore);

module.exports = router;
