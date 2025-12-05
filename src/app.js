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

/**
 * API Info route
 */
router.get(API_VERSION, (req, res) => {
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

      // company: {
      //   "GET /api/company/profile": "ดึงข้อมูลบริษัท",
      //   "PUT /api/company/profile": "แก้ไขข้อมูลบริษัท",
      //   "GET /api/company/subscription": "ดึงสถานะ Subscription",
      // },
      // departments: {
      //   "GET /api/departments": "ดึงรายชื่อแผนกทั้งหมด",
      //   "GET /api/departments/:id": "ดึงข้อมูลแผนกตาม ID",
      //   "POST /api/departments": "สร้างแผนกใหม่",
      //   "PUT /api/departments/:id": "แก้ไขแผนก",
      //   "DELETE /api/departments/:id": "ลบแผนก",
      // },
    },
  });
});

module.exports = router;
