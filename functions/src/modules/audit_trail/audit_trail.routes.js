const express = require("express");
const auditTrailController = require("./audit_trail.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// Middleware: ตรวจสอบการ Login
router.use(protect);

// Middleware: จำกัดสิทธิ์เฉพาะ Admin หรือ Super Admin
router.use(restrictTo("super_admin", "admin"));

// Endpoint: /api/audit-trails - ดึงรายการ Audit Logs
router.get("/", auditTrailController.getAuditLogs);

// Endpoint: /api/audit-trails/:id - ดึงรายละเอียด Audit Log
router.get("/:id", auditTrailController.getAuditLogById);

module.exports = router;
