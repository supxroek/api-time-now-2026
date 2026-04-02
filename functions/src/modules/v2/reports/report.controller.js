const catchAsync = require("../../../utils/catchAsync");
const ReportService = require("./report.service");

class ReportController {
  getIndividualSummary = catchAsync(async (req, res, _next) => {
    const result = await ReportService.getIndividualSummary(
      req.user,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getEmployeeSummary = catchAsync(async (req, res, _next) => {
    const result = await ReportService.getEmployeeSummary(req.user, req.query);

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getDailyAttendance = catchAsync(async (req, res, _next) => {
    const result = await ReportService.getDailyAttendance(req.user, req.query);

    res.status(200).json({
      status: "success",
      data: result,
    });
  });
}

module.exports = new ReportController();
