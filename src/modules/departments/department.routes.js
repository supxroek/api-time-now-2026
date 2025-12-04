/**
 * /src/modules/departments/department.routes.js
 *
 * Departments Routes
 * กำหนดเส้นทาง API สำหรับการจัดการแผนก
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
    "/", //สำหรับดึงข้อมูลแผนกทั้งหมด พร้อมจำนวนพนักงานในแต่ละแผนก
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(departmentSchemas.get),
    DepartmentController.getDepartments
  )
  .post(
    "/", //สำหรับสร้างแผนกใหม่
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(departmentSchemas.create, "body"),
    DepartmentController.createDepartment
  )
  .get(
    "/:id", //สำหรับดึงข้อมูลแผนกตาม ID
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(departmentSchemas.getById, "params"),
    DepartmentController.getDepartmentById
  )
  .patch(
    "/:id", //สำหรับอัปเดตข้อมูลแผนกตาม ID
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(departmentSchemas.update, "body"),
    DepartmentController.updateDepartment
  )
  .delete(
    "/:id", //สำหรับลบแผนกตาม ID
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(departmentSchemas.delete, "params"),
    DepartmentController.deleteDepartment
  );

module.exports = router;
