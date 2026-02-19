const DashboardService = require("./dashboard.service");
const catchAsync = require("../../utils/catchAsync");

// Dashboard Controller
class DashboardController {
  // ==============================================================
  // ดึงข้อมูลภาพรวม Dashboard
  getOverview = catchAsync(async (req, res, next) => {
    const result = await DashboardService.getDashboardOverview(
      req.user.company_id,
    );
    res.status(200).json({ status: "success", data: result });
  });
}

module.exports = new DashboardController();
