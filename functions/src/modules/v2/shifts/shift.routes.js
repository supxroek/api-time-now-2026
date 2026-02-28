const express = require("express");
const shiftController = require("./shift.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .get(restrictTo("super_admin", "admin", "manager"), shiftController.getAll)
  .post(restrictTo("super_admin", "admin"), shiftController.create);

router
  .route("/:id")
  .get(restrictTo("super_admin", "admin", "manager"), shiftController.getOne)
  .patch(restrictTo("super_admin", "admin"), shiftController.update)
  .delete(restrictTo("super_admin", "admin"), shiftController.delete);

router
  .route("/:id/restore")
  .patch(restrictTo("super_admin", "admin"), shiftController.restore);

module.exports = router;
