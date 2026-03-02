const catchAsync = require("../../../utils/catchAsync");
const DashboardService = require("./dashboard.service");

class DashboardController {
  getOverview = catchAsync(async (req, res, _next) => {
    const result = await DashboardService.getDashboardOverview(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });
}

module.exports = new DashboardController();
