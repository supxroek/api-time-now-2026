/**
 * /src/modules/employees/employee.routes.js
 *
 * Employees Routes
 * กำหนดเส้นทาง (routes) สำหรับการจัดการข้อมูลพนักงาน
 */

const express = require("express");
const multer = require("multer");
const router = express.Router();

// Import Employee Controller and Middleware
const EmployeeController = require("./employee.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  validate,
  employeeSchemas,
} = require("../../middleware/validate.middleware");

// กำหนด multer สำหรับรับไฟล์อัปโหลด (เก็บใน memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // จำกัดขนาดไฟล์ 10MB
  fileFilter: (req, file, cb) => {
    // รองรับ XLS, XLSX และ CSV
    const allowedMimes = [
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "text/csv", // .csv
      "application/csv", // .csv (alternative)
      "text/plain", // .csv (some systems send as text/plain)
    ];
    // ตรวจสอบ extension ด้วยเพื่อความแม่นยำ
    const allowedExtensions = [".xls", ".xlsx", ".csv"];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf("."));

    if (
      allowedMimes.includes(file.mimetype) ||
      allowedExtensions.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only XLS, XLSX, and CSV files are supported"), false);
    }
  },
});

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

// Special Route - รองรับทั้ง JSON body และไฟล์ Excel
router.post(
  "/import",
  authenticate,
  upload.single("file"), // รับไฟล์ชื่อ "file" (optional)
  EmployeeController.importEmployees
);

module.exports = router;
