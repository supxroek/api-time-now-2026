const catchAsync = require("../../../utils/catchAsync");
const StatsService = require("./stats.service");

class StatsController {
  getOverview = catchAsync(async (req, res, _next) => {
    const overview = await StatsService.getOverview(req.user.company_id);

    res.status(200).json({
      status: "success",
      data: overview,
    });
  });

  getIndividualSummary = catchAsync(async (req, res, _next) => {
    const result = await StatsService.getIndividualSummary(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getEmployeeSummary = catchAsync(async (req, res, _next) => {
    const result = await StatsService.getEmployeeSummary(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getDailyAttendance = catchAsync(async (req, res, _next) => {
    const result = await StatsService.getDailyAttendance(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });
}

module.exports = new StatsController();
