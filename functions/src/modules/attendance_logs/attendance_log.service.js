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
      department_id,
      search,
      start_date,
      end_date,
      log_type,
    } = query;
    const offset = (page - 1) * limit;

    const filters = {
      employee_id,
      department_id,
      search,
      start_date,
      end_date,
      log_type,
    };

    const logs = await AttendanceLogModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await AttendanceLogModel.countAll(companyId, filters);

    // stats: สถิติการเข้าออกงาน เช่น (พนักงานทั้งหมด, มาทำงาน, ขาดงาน, มาสาย) ในวันนั้นๆ
    const stats = await AttendanceLogModel.getStats(companyId);

    return {
      logs,
      stats,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEmployeeAttendanceHistory(companyId, employeeId, query) {
    const { start_date, end_date } = query;
    const history = await AttendanceLogModel.findHistoryByEmployee(
      companyId,
      employeeId,
      { start_date, end_date },
    );
    return history;
  }

  async getDailySummary(companyId, query) {
    const { date, department_id, search } = query;
    return await AttendanceLogModel.getDailySummary(companyId, {
      date,
      department_id,
      search,
    });
  }
}

module.exports = new AttendanceLogService();
