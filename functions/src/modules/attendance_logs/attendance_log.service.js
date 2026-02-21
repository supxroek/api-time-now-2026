const AttendanceLogModel = require("./attendance_log.model");
const AppError = require("../../utils/AppError");

// Attendance Log Service
class AttendanceLogService {
  // ==============================================================
  // สร้างบันทึกการเข้าออกงาน (พร้อมยืนยัน roster)
  async createAttendanceLog(companyId, payload) {
    const {
      employee_id,
      device_id,
      log_type,
      log_timestamp,
      latitude,
      longitude,
      status,
    } = payload;

    if (!employee_id || !log_type) {
      throw new AppError("กรุณาระบุ employee_id และ log_type", 400);
    }

    const timestamp = log_timestamp ? new Date(log_timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      throw new AppError("รูปแบบ log_timestamp ไม่ถูกต้อง", 400);
    }

    const workDate = timestamp.toISOString().split("T")[0];

    const employee = await AttendanceLogModel.findActiveEmployeeById(
      companyId,
      employee_id,
    );
    if (!employee) {
      throw new AppError("ไม่พบพนักงานที่พร้อมใช้งานในบริษัทนี้", 404);
    }

    let roster = await AttendanceLogModel.findRosterByEmployeeAndDate(
      employee_id,
      workDate,
    );

    if (!roster) {
      const shiftId = employee.default_shift_id;
      if (!shiftId) {
        throw new AppError(
          "ไม่พบ roster สำหรับวันนี้และพนักงานยังไม่มีกะงานเริ่มต้น (default_shift_id)",
          400,
        );
      }

      try {
        const rosterId = await AttendanceLogModel.createRosterForAttendance({
          employee_id,
          shift_id: shiftId,
          work_date: workDate,
        });
        roster = { id: rosterId };
      } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") {
          roster = await AttendanceLogModel.findRosterByEmployeeAndDate(
            employee_id,
            workDate,
          );
        } else {
          throw error;
        }
      }
    }

    const newLogId = await AttendanceLogModel.createAttendanceLog({
      employee_id,
      roster_id: roster.id,
      device_id,
      log_type,
      log_timestamp: timestamp,
      latitude,
      longitude,
      status,
    });

    return {
      id: newLogId,
      employee_id,
      roster_id: roster.id,
      log_type,
      log_timestamp: timestamp,
      status: status || null,
    };
  }

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
    const stats = await AttendanceLogModel.getStats(companyId, filters);

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
