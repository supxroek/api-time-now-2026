/**
 * /src/modules/employees/employee.routes.js
 *
 * Employees Routes
 * กำหนดเส้นทาง (routes) สำหรับการจัดการข้อมูลพนักงาน
 */

const express = require("express");
const router = express.Router();

// Import Employee Controller and Middleware
const EmployeeController = require("./employee.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  validate,
  employeeSchemas,
} = require("../../middleware/validate.middleware");

// กำหนดเส้นทาง API ที่นี้
router
  //
  .get(
    "/",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(employeeSchemas.get), // ตรวจสอบข้อมูลขาเข้า
    EmployeeController.getEmployees
  )
  .post(
    "/",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(employeeSchemas.create, "body"), // ตรวจสอบข้อมูลขาเข้า
    EmployeeController.createEmployee
  )
  .get(
    "/:id",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(employeeSchemas.getEmployeeById, "params"), // ตรวจสอบข้อมูลขาเข้า
    EmployeeController.getEmployeeById
  )
  .patch(
    "/:id",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(employeeSchemas.update, "body"), // ตรวจสอบข้อมูลขาเข้า
    EmployeeController.updateEmployee
  )
  .patch(
    "/:id/resign",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(employeeSchemas.resign, "body"), // ตรวจสอบข้อมูลขาเข้า
    EmployeeController.resignEmployee
  );

// Special Route
router.post("/import", authenticate, EmployeeController.importEmployees);

module.exports = router;
