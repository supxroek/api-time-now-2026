const AttendanceLogModel = require("./attendance_log.model");
const AppError = require("../../utils/AppError");
const db = require("../../config/db.config");
const {
  normalizeDate,
  DEFAULT_TZ,
  toDefaultTz,
  buildDateTimeInDefaultTz,
} = require("../../utils/date");
const DayResolutionService = require("../day_resolution/day_resolution.service");

const ATTENDANCE_TZ = DEFAULT_TZ; // ใช้ timezone กลางสำหรับการประมวลผลเวลาเข้าออกงานทั้งหมด
const DEFAULT_GRACE_MINUTES = Number(process.env.ATTENDANCE_GRACE_MINUTES || 0); // กำหนดเวลาปรับสาย (เช่น 5 หมายถึง มาสายได้ไม่เกิน 5 นาที)
const IDEMPOTENT_WINDOW_SECONDS = Number(
  process.env.ATTENDANCE_IDEMPOTENT_WINDOW_SECONDS || 120,
); // หน่วงเวลาในการตรวจสอบ log ซ้ำ (เช่น 120 หมายถึง ถ้ามี log เดิมที่ timestamp ใกล้เคียงกันใน 2 นาที จะถือว่าเป็น log เดิมและไม่สร้างใหม่)

// Attendance Log Service
class AttendanceLogService {
  mapBaseDayType(baseDayStatus) {
    const mapper = {
      leave: "leave",
      holiday_swap: "holiday_swap",
      public_holiday: "public_holiday",
      compensatory_holiday: "compensatory_holiday",
      weekly_holiday: "weekly_holiday",
      working_day: "working_day",
    };

    return mapper[baseDayStatus] || "working_day";
  }

  getRosterSnapshotFromResolution(resolution) {
    const baseDayStatus = resolution.base_day_status;
    return {
      company_id: resolution.company_id,
      employee_id: resolution.employee_id,
      shift_id: resolution.effective_shift.shift_id,
      work_date: resolution.work_date,
      is_ot_allowed: 0,
      is_public_holiday:
        baseDayStatus === "public_holiday" ||
        baseDayStatus === "compensatory_holiday"
          ? 1
          : 0,
      leave_status:
        baseDayStatus === "leave"
          ? resolution.flags?.leave_status || "full_day"
          : "none",
      is_holiday_swap: baseDayStatus === "holiday_swap" ? 1 : 0,
      is_compensatory: baseDayStatus === "compensatory_holiday" ? 1 : 0,
      source_system: resolution.day_source,
      base_day_type: this.mapBaseDayType(baseDayStatus),
    };
  }

  buildShiftDateTime(workDate, timeString) {
    return buildDateTimeInDefaultTz(workDate, timeString);
  }

  calculateLateMinutes(shiftStartAt, scanAt) {
    if (!shiftStartAt || !scanAt) return 0;
    const graceThreshold = shiftStartAt.add(DEFAULT_GRACE_MINUTES, "minute");
    const diff = scanAt.diff(graceThreshold, "minute");
    return Math.max(diff, 0);
  }

  calculateEarlyExitMinutes(shiftEndAt, scanAt) {
    if (!shiftEndAt || !scanAt) return 0;
    const diff = shiftEndAt.diff(scanAt, "minute");
    return Math.max(diff, 0);
  }

  calculateOtMinutes(shiftEndAt, scanAt, otInTimestamp = null) {
    if (otInTimestamp) {
      const otInAt = toDefaultTz(otInTimestamp);
      const diff = scanAt.diff(otInAt, "minute");
      return Math.max(diff, 0);
    }

    if (!shiftEndAt || !scanAt) return 0;
    const diff = scanAt.diff(shiftEndAt, "minute");
    return Math.max(diff, 0);
  }

  buildComputedMetrics(logType, resolution, timestamp, latestOtInLog = null) {
    const scanAt = toDefaultTz(timestamp);
    const shiftStartAt = this.buildShiftDateTime(
      resolution.work_date,
      resolution.effective_shift.start_time,
    );
    const shiftEndAt = this.buildShiftDateTime(
      resolution.work_date,
      resolution.effective_shift.end_time,
    );

    const baseDayStatus = resolution.base_day_status;
    const leaveStatus = String(resolution.flags?.leave_status || "none");

    const lateMinutes =
      logType === "check_in" && baseDayStatus !== "leave"
        ? this.calculateLateMinutes(shiftStartAt, scanAt)
        : 0;

    const earlyExitMinutes =
      logType === "check_out"
        ? this.calculateEarlyExitMinutes(shiftEndAt, scanAt)
        : 0;

    let otMinutes = 0;
    if (logType === "ot_out") {
      otMinutes = this.calculateOtMinutes(
        shiftEndAt,
        scanAt,
        latestOtInLog?.log_timestamp,
      );
    } else if (logType === "check_out") {
      otMinutes = this.calculateOtMinutes(shiftEndAt, scanAt);
    }

    let attendanceStatus = "normal";
    if (baseDayStatus === "leave" && logType === "check_in") {
      attendanceStatus = "failed";
    } else if (logType === "check_in" && lateMinutes > 0) {
      attendanceStatus = "late";
    } else if (logType === "check_out" && earlyExitMinutes > 0) {
      attendanceStatus = "early_exit";
    }

    const absence = false;
    const compensatoryEligibility = [
      "public_holiday",
      "compensatory_holiday",
      "weekly_holiday",
      "holiday_swap",
    ].includes(baseDayStatus);

    return {
      timezone: ATTENDANCE_TZ,
      attendance_status: attendanceStatus,
      late_minutes: lateMinutes,
      early_exit_minutes: earlyExitMinutes,
      ot_minutes: otMinutes,
      absence,
      compensatory_eligibility: compensatoryEligibility,
      leave_status: leaveStatus,
    };
  }

  // ==============================================================
  // สร้างบันทึกการเข้าออกงาน (พร้อมยืนยัน roster)
  async createAttendanceLog(companyId, payload) {
    const { employee_id, device_id, log_type, log_timestamp } = payload;

    if (!employee_id || !log_type) {
      throw new AppError("กรุณาระบุ employee_id และ log_type", 400);
    }

    const timestamp = log_timestamp ? new Date(log_timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      throw new AppError("รูปแบบ log_timestamp ไม่ถูกต้อง", 400);
    }

    const workDate = normalizeDate(timestamp.toISOString());

    const resolution = await DayResolutionService.getEmployeeDayResolution(
      companyId,
      employee_id,
      workDate,
    );

    const employee = await AttendanceLogModel.findActiveEmployeeById(
      companyId,
      employee_id,
    );

    if (!employee) {
      throw new AppError("ไม่พบพนักงานที่พร้อมใช้งานในบริษัทนี้", 404);
    }

    const connection = await db.getConnection();
    let roster = null;
    let newLogId = null;
    let duplicateLog = null;
    let latestOtInLog = null;

    try {
      await connection.beginTransaction();

      roster = await AttendanceLogModel.findRosterByEmployeeAndDate(
        companyId,
        employee_id,
        workDate,
        connection,
      );

      if (!roster) {
        try {
          const rosterId = await AttendanceLogModel.createRosterForAttendance(
            this.getRosterSnapshotFromResolution(resolution),
            connection,
          );
          roster = { id: rosterId };
        } catch (error) {
          if (error?.code === "ER_DUP_ENTRY") {
            roster = await AttendanceLogModel.findRosterByEmployeeAndDate(
              companyId,
              employee_id,
              workDate,
              connection,
            );
          } else {
            throw error;
          }
        }
      }

      duplicateLog = await AttendanceLogModel.findPotentialDuplicateLog(
        Number(companyId),
        Number(employee_id),
        Number(roster.id),
        log_type,
        timestamp,
        device_id,
        IDEMPOTENT_WINDOW_SECONDS,
        connection,
      );

      if (duplicateLog) {
        await connection.rollback();
        const duplicateMetrics = this.buildComputedMetrics(
          log_type,
          resolution,
          duplicateLog.log_timestamp,
          null,
        );
        return {
          id: duplicateLog.id,
          company_id: Number(companyId),
          employee_id,
          roster_id: roster.id,
          log_type: duplicateLog.log_type,
          log_timestamp: duplicateLog.log_timestamp,
          status: duplicateLog.status,
          idempotent_reused: true,
          metrics: duplicateMetrics,
          resolution: {
            day_source: resolution.day_source,
            base_day_status: resolution.base_day_status,
            effective_shift_mode: resolution.effective_shift.mode,
          },
        };
      }

      if (log_type === "ot_out") {
        latestOtInLog = await AttendanceLogModel.findLatestLogByType(
          Number(companyId),
          Number(employee_id),
          Number(roster.id),
          "ot_in",
          connection,
        );
      }

      const metrics = this.buildComputedMetrics(
        log_type,
        resolution,
        timestamp,
        latestOtInLog,
      );

      newLogId = await AttendanceLogModel.createAttendanceLog(
        {
          company_id: Number(companyId),
          employee_id,
          roster_id: roster.id,
          device_id,
          log_type,
          log_timestamp: timestamp,
          status: metrics.attendance_status,
        },
        connection,
      );

      await connection.commit();

      return {
        id: newLogId,
        company_id: Number(companyId),
        employee_id,
        roster_id: roster.id,
        log_type,
        log_timestamp: timestamp,
        status: metrics.attendance_status,
        idempotent_reused: false,
        metrics,
        resolution: {
          day_source: resolution.day_source,
          base_day_status: resolution.base_day_status,
          effective_shift_mode: resolution.effective_shift.mode,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
