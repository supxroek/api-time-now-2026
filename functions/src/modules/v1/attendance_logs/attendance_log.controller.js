const AttendanceLogService = require("./attendance_log.service");
const catchAsync = require("../../../utils/catchAsync");

// Attendance Log Controller
class AttendanceLogController {
  // ==============================================================
  // บันทึกการเข้าออกงาน
  create = catchAsync(async (req, res, next) => {
    const result = await AttendanceLogService.createAttendanceLog(
      req.user.company_id,
      req.body,
    );

    res.status(201).json({ status: "success", data: { log: result } });
  });

  // ==============================================================
  // ดึงบันทึกการเข้าออกงานทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await AttendanceLogService.getAttendanceLogs(
      req.user.company_id,
      req.query,
    );
    res.status(200).json({ status: "success", data: result });
  });

  getHistory = catchAsync(async (req, res, next) => {
    const result = await AttendanceLogService.getEmployeeAttendanceHistory(
      req.user.company_id,
      req.params.employeeId,
      req.query,
    );
    res.status(200).json({ status: "success", data: result });
  });

  getDailySummary = catchAsync(async (req, res, next) => {
    const result = await AttendanceLogService.getDailySummary(
      req.user.company_id,
      req.query,
    );
    res.status(200).json({ status: "success", data: result });
  });
}

module.exports = new AttendanceLogController();
