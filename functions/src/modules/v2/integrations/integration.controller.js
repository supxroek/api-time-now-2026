const catchAsync = require("../../../utils/catchAsync");
const IntegrationService = require("./integration.service");

class IntegrationController {
  getLeaveHubStatus = catchAsync(async (req, res, _next) => {
    const result = await IntegrationService.getLeaveHubStatus(
      req.user.company_id,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  connectLeaveHub = catchAsync(async (req, res, _next) => {
    const result = await IntegrationService.connectLeaveHub(
      req.user,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      message: "เชื่อมต่อ Leavehub สำเร็จ",
      data: result,
    });
  });

  disconnectLeaveHub = catchAsync(async (req, res, _next) => {
    const result = await IntegrationService.disconnectLeaveHub(
      req.user,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      message: "ยกเลิกการเชื่อมต่อ Leavehub สำเร็จ",
      data: result,
    });
  });

  syncLeaveHub = catchAsync(async (req, res, _next) => {
    const result = await IntegrationService.syncLeaveHub(req.user, req.ip);

    res.status(200).json({
      status: "success",
      message: "ซิงก์ Leavehub สำเร็จ",
      data: result,
    });
  });
}

module.exports = new IntegrationController();
