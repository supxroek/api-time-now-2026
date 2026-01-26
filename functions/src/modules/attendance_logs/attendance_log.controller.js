const AttendanceLogService = require("./attendance_log.service");
const catchAsync = require("../../utils/catchAsync");

// Attendance Log Controller
class AttendanceLogController {
  // ==============================================================
  // ดึงบันทึกการเข้าออกงานทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await AttendanceLogService.getAttendanceLogs(
      req.user.company_id,
      req.query,
    );
    res.status(200).json({ status: "success", data: result });
  });
}

module.exports = new AttendanceLogController();
