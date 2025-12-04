/**
 * /src/modules/organization/org.routes.js
 *
 * Organization Routes
 * กำหนดเส้นทาง API สำหรับการจัดการองค์กร
 */

const express = require("express");
const router = express.Router();

// import controllers and middleware
const DepartmentController = require("./department.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  validate,
  departmentSchemas,
} = require("../../middleware/validate.middleware");

// กำหนดเส้นทาง API ที่นี้
router
  .get(
    "/",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(departmentSchemas.get),
    DepartmentController.getDepartments
  )
  .post(
    "/",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(departmentSchemas.create),
    DepartmentController.createDepartment
  )
  .get(
    "/:id",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(departmentSchemas.getById),
    DepartmentController.getDepartmentById
  )
  .put(
    "/:id",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(departmentSchemas.update),
    DepartmentController.updateDepartment
  )
  .delete(
    "/:id",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(departmentSchemas.delete),
    DepartmentController.deleteDepartment
  );
module.exports = router;
