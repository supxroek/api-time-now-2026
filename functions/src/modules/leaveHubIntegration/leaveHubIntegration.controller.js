const catchAsync = require("../../utils/catchAsync");
const LeaveHubIntegrationService = require("./leaveHubIntegration.service");

class LeaveHubIntegrationController {
  // ==============================================================
  // เชื่อมต่อ LeaveHub ครั้งแรก
  connectLeaveHub = catchAsync(async (req, res, _next) => {
    const result = await LeaveHubIntegrationService.connectLeaveHub(
      req.user,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      message: "เชื่อมต่อ LeaveHub สำเร็จ",
      data: result,
    });
  });

  // ==============================================================
  // ซิงก์ข้อมูลล่าสุดโดย re-login อัตโนมัติ
  syncLeaveHub = catchAsync(async (req, res, _next) => {
    const result = await LeaveHubIntegrationService.syncLeaveHubData(
      req.user,
      req.user.company_id,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      message: "ซิงก์ข้อมูล LeaveHub สำเร็จ",
      data: result,
    });
  });

  // ==============================================================
  // ยกเลิกการเชื่อมต่อ LeaveHub
  disconnectLeaveHub = catchAsync(async (req, res, _next) => {
    const result = await LeaveHubIntegrationService.disconnectLeaveHub(
      req.user,
      req.user.company_id,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      message: "ยกเลิกการเชื่อมต่อ LeaveHub สำเร็จ",
      data: result,
    });
  });

  // ==============================================================
  // ดึงข้อมูล context สำหรับแสดงตารางเวรจาก LeaveHub
  getRosterContext = catchAsync(async (req, res, _next) => {
    const result = await LeaveHubIntegrationService.getRosterContext(
      req.user,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });
}

module.exports = new LeaveHubIntegrationController();
