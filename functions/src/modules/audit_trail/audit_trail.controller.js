const AuditTrailService = require("./audit_trail.service");
const catchAsync = require("../../utils/catchAsync");

// Audit Trail Controller
class AuditTrailController {
  // ==============================================================
  // ดึงรายการ Audit Logs
  getAuditLogs = catchAsync(async (req, res, next) => {
    const result = await AuditTrailService.getAuditLogs(req.user, req.query);

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // ดึงรายละเอียด Audit Log ตาม ID
  getAuditLogById = catchAsync(async (req, res, next) => {
    const result = await AuditTrailService.getAuditLogById(
      req.user,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });
}

module.exports = new AuditTrailController();
