const RequestService = require("./request.service");
const catchAsync = require("../../utils/catchAsync");

// Request Controller
class RequestController {
  // ==============================================================
  // ดึงประวัติคำขอทั้งหมด
  getHistory = catchAsync(async (req, res, next) => {
    const result = await RequestService.getRequestHistory(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // สรุปสถิติ
  getStats = catchAsync(async (req, res, next) => {
    const stats = await RequestService.getStats(req.user.company_id);

    res.status(200).json({
      status: "success",
      data: stats,
    });
  });
}

module.exports = new RequestController();
