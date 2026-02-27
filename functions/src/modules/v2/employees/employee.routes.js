const express = require("express");
const employeeController = require("./employee.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/employees
  .route("/")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    employeeController.getAll,
  );

router
  // Endpoint: GET /api/v2/employees/:id
  .route("/:id")
  .get(restrictTo("super_admin", "admin", "manager"), employeeController.getOne)
  .patch(restrictTo("super_admin", "admin"), employeeController.update)
  .delete(restrictTo("super_admin", "admin"), employeeController.delete);

module.exports = router;
