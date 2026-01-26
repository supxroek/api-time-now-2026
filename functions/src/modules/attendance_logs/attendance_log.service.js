const AttendanceLogModel = require("./attendance_log.model");

// Attendance Log Service
class AttendanceLogService {
  // ==============================================================
  // ดึงบันทึกการเข้าออกงานทั้งหมด
  async getAttendanceLogs(companyId, query) {
    const {
      page = 1,
      limit = 50,
      employee_id,
      start_date,
      end_date,
      log_type,
    } = query;
    const offset = (page - 1) * limit;

    const filters = { employee_id, start_date, end_date, log_type };

    const logs = await AttendanceLogModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await AttendanceLogModel.countAll(companyId, filters);

    return {
      logs,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = new AttendanceLogService();
