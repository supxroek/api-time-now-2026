/**
 * /src/app.js
 *
 * Central Route Registry
 * รวบรวมและ Export Routes ทั้งหมด
 */

const express = require("express");
const router = express.Router();

// Import routes
const companyRoutes = require("./api/routes/company.routes");
const departmentRoutes = require("./api/routes/department.routes");

// API Version prefix
const API_VERSION = "/api";

/**
 * Mount routes
 */
router.use(`${API_VERSION}/company`, companyRoutes);
router.use(`${API_VERSION}/departments`, departmentRoutes);

/**
 * API Info route
 */
router.get(API_VERSION, (req, res) => {
  res.json({
    success: true,
    message: "Time Now API",
    version: "1.0.0",
    endpoints: {
      company: {
        "GET /api/company/profile": "ดึงข้อมูลบริษัท",
        "PUT /api/company/profile": "แก้ไขข้อมูลบริษัท",
        "GET /api/company/subscription": "ดึงสถานะ Subscription",
      },
      departments: {
        "GET /api/departments": "ดึงรายชื่อแผนกทั้งหมด",
        "GET /api/departments/:id": "ดึงข้อมูลแผนกตาม ID",
        "POST /api/departments": "สร้างแผนกใหม่",
        "PUT /api/departments/:id": "แก้ไขแผนก",
        "DELETE /api/departments/:id": "ลบแผนก",
      },
    },
  });
});

module.exports = router;
