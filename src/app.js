/**
 * /src/app.js
 *
 * Central Route Registry
 * รวบรวมและ Export Routes ทั้งหมด
 */

const express = require("express");
const router = express.Router();

// Import routes
const authRoutes = require("./modules/auth/auth.routes");
const companyRoutes = require("./modules/companies/company.routes");
const departmentRoutes = require("./modules/departments/department.routes");
const employeeRoutes = require("./modules/employees/employee.routes");
const attendanceRoutes = require("./modules/attendance/attendance.routes");
const devicesRoutes = require("./modules/devices/devices.routes");
const overtimeRoutes = require("./modules/overtime/overtime.routes");
const shiftRoutes = require("./modules/shifts/shifts.routes");

// API Version prefix
const API_VERSION = "/api";

/**
 * Mount routes
 */
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/company`, companyRoutes);
router.use(`${API_VERSION}/company/departments`, departmentRoutes);
router.use(`${API_VERSION}/company/employees`, employeeRoutes);
router.use(`${API_VERSION}/attendance`, attendanceRoutes);
router.use(`${API_VERSION}/devices`, devicesRoutes);
router.use(`${API_VERSION}/overtimes`, overtimeRoutes);
router.use(`${API_VERSION}/shifts`, shiftRoutes);

/**
 * API Info route
 */
router.use(API_VERSION, (req, res) => {
  res.json({
    success: true,
    message: "Time Now API",
    version: "1.0.0",
    endpoints: {
      auth: {
        "POST /api/auth/login": "เข้าสู่ระบบ",
        "POST /api/auth/register": "ลงทะเบียนผู้ใช้ใหม่", // อาจจะไม่ได้ใช้
        "POST /api/auth/refresh-token": "รีเฟรชโทเค็น",
      },
      company: {
        "GET /api/company/profile": "ดึงข้อมูลบริษัท",
        "PATCH /api/company/profile": "แก้ไขข้อมูลบริษัท",
      },
      departments: {
        "GET /api/departments": "ดึงรายชื่อแผนกทั้งหมด",
        "GET /api/departments/:id": "ดึงข้อมูลแผนกตาม ID",
        "POST /api/departments": "สร้างแผนกใหม่",
        "PATCH /api/departments/:id": "แก้ไขแผนก",
        "DELETE /api/departments/:id": "ลบแผนก",
      },
      employees: {
        "GET /api/company/employees": "ดึงรายชื่อพนักงานทั้งหมด",
        "GET /api/company/employees/:id": "ดึงข้อมูลพนักงานตาม ID",
        "POST /api/company/employees": "สร้างพนักงานใหม่",
        "PATCH /api/company/employees/:id": "แก้ไขข้อมูลพนักงาน",
        "PATCH /api/company/employees/:id/resign":
          "อัพเดตสถานะพนักงานเป็นลาออก",
        "POST /api/company/employees/import":
          "นำเข้าข้อมูลพนักงานจากไฟล์ Excel, CSV",
      },
      shifts: {
        "GET /api/shifts": "ดึงรายชื่อกะการทำงานทั้งหมด",
        "POST /api/shifts": "สร้างกะการทำงานใหม่",
        "PATCH /api/shifts/:id": "อัปเดตกะการทำงาน",
        "POST /api/shifts/assign": "กำหนดกะการทำงานให้พนักงาน",
      },
      overtime: {
        "GET /api/overtimes": "ดึงรายชื่อชั่วโมงทำงานล่วงเวลาทั้งหมด",
        "POST /api/overtimes": "สร้างชั่วโมงทำงานล่วงเวลาใหม่",
      },
      attendance: {
        "POST /api/attendance/clock-in": "บันทึกเวลาเข้างาน",
        "POST /api/attendance/clock-out": "บันทึกเวลาออกงาน",
        "POST /api/attendance/break-start": "บันทึกเวลาเริ่มพัก",
        "POST /api/attendance/break-end": "บันทึกเวลาสิ้นสุดการพัก",
        "GET /api/attendance/today": "ดึงบันทึกการเข้างานของวันนี้",
        "GET /api/attendance/history": "ดึงประวัติการเข้างาน",
        "GET /api/attendance/summary": "ดึงสรุปการเข้างานรายเดือน",
      },
      devices: {
        "GET /api/devices": "ดึงรายชื่ออุปกรณ์ทั้งหมด",
        "POST /api/devices": "ลงทะเบียนอุปกรณ์ใหม่",
        "PATCH /api/devices/:id": "แก้ไขข้อมูลอุปกรณ์",
        "POST /api/devices/sync": "ซิงค์ข้อมูลการเข้างานจากอุปกรณ์",
      },
    },
  });
});

module.exports = router;
