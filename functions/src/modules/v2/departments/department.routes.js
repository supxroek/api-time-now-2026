const express = require("express");
const departmentController = require("./department.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/departments/overview
  .route("/overview")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    departmentController.getOverview,
  );

router
  // Endpoint: GET /api/v2/departments
  .route("/")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    departmentController.getAll,
  )
  .post(restrictTo("super_admin", "admin"), departmentController.create);

router
  // Endpoint: GET /api/v2/departments/:id
  .route("/:id")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    departmentController.getOne,
  )
  .patch(restrictTo("super_admin", "admin"), departmentController.update)
  .delete(restrictTo("super_admin", "admin"), departmentController.delete);

module.exports = router;
