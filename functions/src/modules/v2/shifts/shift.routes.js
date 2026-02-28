const express = require("express");
const shiftController = require("./shift.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    shiftController.getAllShifts,
  )
  .post(restrictTo("super_admin", "admin"), shiftController.createShift);

router
  .route("/:id")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    shiftController.getShiftById,
  )
  .patch(restrictTo("super_admin", "admin"), shiftController.updateShift)
  .delete(restrictTo("super_admin", "admin"), shiftController.deleteShift);

router
  .route("/:id/restore")
  .patch(restrictTo("super_admin", "admin"), shiftController.restoreShift);

router
  .route("/assignments")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    shiftController.getAssignments,
  )
  .post(restrictTo("super_admin", "admin"), shiftController.createAssignment);

router
  .route("/assignments/:id")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    shiftController.getAssignmentById,
  )
  .patch(restrictTo("super_admin", "admin"), shiftController.updateAssignment)
  .delete(restrictTo("super_admin", "admin"), shiftController.deleteAssignment);

router
  .route("/custom-days")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    shiftController.getCustomDays,
  )
  .post(restrictTo("super_admin", "admin"), shiftController.createCustomDay);

router
  .route("/custom-days/:id")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    shiftController.getCustomDayById,
  )
  .patch(restrictTo("super_admin", "admin"), shiftController.updateCustomDay)
  .delete(restrictTo("super_admin", "admin"), shiftController.deleteCustomDay);

module.exports = router;
