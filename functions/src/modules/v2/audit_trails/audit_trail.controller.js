const catchAsync = require("../../../utils/catchAsync");
const AuditTrailService = require("./audit_trail.service");

class AuditTrailController {
  getList = catchAsync(async (req, res, _next) => {
    const result = await AuditTrailService.getAuditTrailList(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getOne = catchAsync(async (req, res, _next) => {
    const auditTrail = await AuditTrailService.getAuditTrailById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { auditTrail },
    });
  });

  getStats = catchAsync(async (req, res, _next) => {
    const stats = await AuditTrailService.getAuditTrailStats(
      req.user.company_id,
    );

    res.status(200).json({
      status: "success",
      data: { stats },
    });
  });
}

module.exports = new AuditTrailController();
