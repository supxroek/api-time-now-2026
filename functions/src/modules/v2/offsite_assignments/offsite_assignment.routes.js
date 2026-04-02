const express = require("express");
const offsiteAssignmentController = require("./offsite_assignment.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  .route("/overview")
  .get(
    restrictTo("super_admin", "admin"),
    offsiteAssignmentController.getOverview,
  );

router
  .route("/")
  .post(restrictTo("super_admin", "admin"), offsiteAssignmentController.create);

router
  .route("/:id")
  .get(restrictTo("super_admin", "admin"), offsiteAssignmentController.getOne)
  .patch(restrictTo("super_admin", "admin"), offsiteAssignmentController.update)
  .delete(
    restrictTo("super_admin", "admin"),
    offsiteAssignmentController.delete,
  );

module.exports = router;
