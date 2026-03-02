const catchAsync = require("../../../utils/catchAsync");
const DayResolutionService = require("./day_resolution.service");

class DayResolutionController {
  getDailySnapshots = catchAsync(async (req, res, _next) => {
    const result = await DayResolutionService.getCompanyDaySnapshots(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getEmployeeResolution = catchAsync(async (req, res, _next) => {
    const result = await DayResolutionService.getEmployeeDayResolution(
      req.user.company_id,
      req.params.employeeId,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  createJitSnapshot = catchAsync(async (req, res, _next) => {
    const result = await DayResolutionService.createJitSnapshot(
      req.user.company_id,
      req.user.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });
}

module.exports = new DayResolutionController();
