const catchAsync = require("../../../utils/catchAsync");
const TimeRecordService = require("./time_record.service");

class TimeRecordController {
  getOverview = catchAsync(async (req, res, _next) => {
    const result = await TimeRecordService.getOverview(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getEmployeeHistory = catchAsync(async (req, res, _next) => {
    const result = await TimeRecordService.getEmployeeHistory(
      req.user.company_id,
      req.params.employeeId,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });
}

module.exports = new TimeRecordController();
