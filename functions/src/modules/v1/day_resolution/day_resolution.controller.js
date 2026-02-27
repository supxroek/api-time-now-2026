const catchAsync = require("../../../utils/catchAsync");
const DayResolutionService = require("./day_resolution.service");

class DayResolutionController {
  getDailySnapshots = catchAsync(async (req, res, next) => {
    const { date, employee_id } = req.query;

    const snapshots = await DayResolutionService.getCompanyDaySnapshots(
      req.user.company_id,
      date,
      employee_id,
    );

    res.status(200).json({
      status: "success",
      data: {
        work_date: date,
        snapshots,
      },
    });
  });

  getEmployeeResolution = catchAsync(async (req, res, next) => {
    const { employeeId } = req.params;
    const { date } = req.query;

    const resolution = await DayResolutionService.getEmployeeDayResolution(
      req.user.company_id,
      employeeId,
      date,
    );

    res.status(200).json({
      status: "success",
      data: {
        resolution,
      },
    });
  });
}

module.exports = new DayResolutionController();
