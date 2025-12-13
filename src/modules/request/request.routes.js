/**
 * /src/modules/request/request.routes.js
 *
 * Request Routes
 * จัดการเส้นทาง API ที่เกี่ยวกับคำขอ
 */

const express = require("express");
const router = express.Router();

// import request controller and middleware
const RequestController = require("./request.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  validate,
  requestSchemas,
} = require("../../middleware/validate.middleware");

// กำหนดเส้นทางที่นี้

// ========= Employee Side (คนขอ) =========
router
  // GET /api/requests/my-requests - ดึงรายการคำขอของผู้ใช้ที่ล็อกอิน
  .get(
    "/my-requests",
    authenticate, // ต้องยืนยันตัวตน
    RequestController.getMyRequests
  )

  // POST /api/requests/forget-time - ส่งคำขอลืมบันทึกเวลา/แก้ไขเวลา
  .post(
    "/forget-time",
    authenticate, // ต้องยืนยันตัวตน
    validate(requestSchemas.forgetTime),
    RequestController.createForgetTimeRequest
  );

// ========= Admin Side (ผู้อนุมัติ) =========
router
  // GET /api/requests/pending - ดึงรายการคำขอที่รอการอนุมัติ
  .get(
    "/pending",
    authenticate, // ต้องยืนยันตัวตน
    RequestController.getPendingRequests
  )

  // GET /api/requests/history - ดึงประวัติคำขอ
  .get(
    "/history",
    authenticate, // ต้องยืนยันตัวตน
    RequestController.getRequestHistory
  )

  // GET /api/requests/stats - ดึงสถิติคำขอ
  .get(
    "/stats",
    authenticate, // ต้องยืนยันตัวตน
    RequestController.getRequestStats
  )

  // PATCH /api/requests/:id/approve - อนุมัติคำขอตาม ID
  .patch(
    "/:id/approve",
    authenticate, // ต้องยืนยันตัวตน
    validate(requestSchemas.requestIdParam, "params"),
    RequestController.approveRequest
  )

  // PATCH /api/requests/:id/reject - ปฏิเสธคำขอตาม ID
  .patch(
    "/:id/reject",
    authenticate, // ต้องยืนยันตัวตน
    validate(requestSchemas.requestIdParam, "params"),
    RequestController.rejectRequest
  );

module.exports = router;
