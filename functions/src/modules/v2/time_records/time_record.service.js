const AppError = require("../../../utils/AppError");
const StatsService = require("../stats/stats.service");
const TimeRecordModel = require("./time_record.model");

class TimeRecordService {
  static LOG_TYPE_LABELS = {
    check_in: "เข้างาน",
    check_out: "ออกงาน",
    break_start: "เริ่มพัก",
    break_end: "จบพัก",
    ot_in: "OT เข้า",
    ot_out: "OT ออก",
  };

  static LOG_STATUS_LABELS = {
    normal: "ปกติ",
    late: "มาสาย",
    early_exit: "ออกก่อนเวลา",
    ot: "OT",
    invalid: "ไม่ถูกต้อง",
    none: "ว่าง",
  };

  static ATTENDANCE_STATUS_LABELS = {
    present: "มาทำงาน",
    incomplete: "ข้อมูลไม่ครบ",
    absent: "ขาดงาน",
    leave: "ลา",
    holiday: "วันหยุด",
    pending: "รอดำเนินการ",
    normal: "ปกติ",
    late: "มาสาย",
    early_exit: "ออกก่อนเวลา",
    late_and_early_exit: "มาสายและออกก่อนเวลา",
    none: "ว่าง",
  };

  normalizeDate(value, fallback) {
    const dateString = String(value || fallback || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      throw new AppError("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)", 400);
    }

    return dateString;
  }

  normalizePage(value, fallback = 1) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  normalizeLimit(value, fallback = 50, max = 200) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.min(Math.floor(parsed), max);
  }

  mapEnum(key, labels) {
    if (!key) return null;

    return {
      key,
      label: labels[key] || key,
    };
  }

  mapRealtimeLog(row) {
    return {
      id: row.id,
      company_id: row.company_id,
      employee_id: row.employee_id,
      device_id: row.device_id,
      log_type: this.mapEnum(row.log_type, TimeRecordService.LOG_TYPE_LABELS),
      log_status: this.mapEnum(
        row.log_status || "none",
        TimeRecordService.LOG_STATUS_LABELS,
      ),
      log_timestamp: row.log_timestamp,
      is_manual: Boolean(row.is_manual),
      day_status: this.mapEnum(
        row.attendance_status || "none",
        TimeRecordService.ATTENDANCE_STATUS_LABELS,
      ),
      // Backward compatibility for existing FE usage.
      status: this.mapEnum(
        row.log_status || "none",
        TimeRecordService.LOG_STATUS_LABELS,
      ),
      employee: {
        id: row.employee_id,
        code: row.employee_code,
        name: row.employee_name,
        avatar: row.employee_avatar,
        department_id: row.department_id,
        department_name: row.department_name,
      },
      device: row.device_id
        ? {
            id: row.device_id,
            name: row.device_name,
            location_name: row.location_name,
          }
        : null,
    };
  }

  mapDailySummaryRow(row) {
    return {
      employee_id: row.employee_id,
      employee_code: row.employee_code,
      employee_name: row.employee_name,
      employee_avatar: row.employee_avatar,
      department_name: row.department_name,
      check_in_time: row.check_in_time,
      break_start_time: row.break_start_time,
      break_end_time: row.break_end_time,
      check_out_time: row.check_out_time,
      ot_in_time: row.ot_in_time,
      ot_out_time: row.ot_out_time,
      latest_status: this.mapEnum(
        row.latest_status || "none",
        TimeRecordService.ATTENDANCE_STATUS_LABELS,
      ),
      metrics: {
        total_work_minutes: Number(row.total_work_minutes || 0),
        break_minutes: Number(row.break_minutes || 0),
        late_minutes: Number(row.late_minutes || 0),
        early_exit_minutes: Number(row.early_exit_minutes || 0),
        total_ot_minutes: Number(row.total_ot_minutes || 0),
      },
    };
  }

  mapHistoryRow(row) {
    return {
      date: row.date,
      checkIn: row.checkIn || "-",
      breakStart: row.breakStart || "-",
      breakEnd: row.breakEnd || "-",
      checkOut: row.checkOut || "-",
      otCheckIn: row.otCheckIn || "-",
      otCheckOut: row.otCheckOut || "-",
      status: this.mapEnum(
        row.status || "none",
        TimeRecordService.ATTENDANCE_STATUS_LABELS,
      ),
      metrics: {
        total_work_minutes: Number(row.total_work_minutes || 0),
        break_minutes: Number(row.break_minutes || 0),
        late_minutes: Number(row.late_minutes || 0),
        early_exit_minutes: Number(row.early_exit_minutes || 0),
        total_ot_minutes: Number(row.total_ot_minutes || 0),
      },
    };
  }

  buildCommonFilters(query = {}) {
    return {
      department_id: query.department_id,
      search: query.search?.trim(),
    };
  }

  buildLogFilters(query = {}) {
    return {
      ...this.buildCommonFilters(query),
      log_type: query.log_type,
      start_date: query.start_date,
      end_date: query.end_date,
    };
  }

  async getOverview(companyId, query = {}) {
    const selectedDate = this.normalizeDate(
      query.date,
      new Date().toISOString().slice(0, 10),
    );

    const startDate = this.normalizeDate(query.start_date, selectedDate);
    const endDate = this.normalizeDate(query.end_date, selectedDate);

    if (startDate > endDate) {
      throw new AppError("start_date ต้องน้อยกว่าหรือเท่ากับ end_date", 400);
    }

    const page = this.normalizePage(query.page, 1);
    const limit = this.normalizeLimit(query.limit, 50, 200);
    const offset = (page - 1) * limit;

    // Daily summary pagination
    const pageDailySummary = this.normalizePage(query.daily_summary_page, 1);
    const dailySummaryLimit = this.normalizeLimit(
      query.daily_summary_limit,
      20,
      100,
    );
    const offsetDailySummary = (pageDailySummary - 1) * dailySummaryLimit;

    const logFilters = this.buildLogFilters({
      ...query,
      start_date: startDate,
      end_date: endDate,
    });

    const summaryFilters = this.buildCommonFilters(query);

    const [
      departments,
      statsOverview,
      logsRows,
      logsTotal,
      summaryTotal,
      summaryRows,
    ] = await Promise.all([
      TimeRecordModel.getDepartmentOptions(companyId),
      StatsService.getOverview(companyId),
      TimeRecordModel.getRealtimeLogs(companyId, logFilters, limit, offset),
      TimeRecordModel.countRealtimeLogs(companyId, logFilters),
      TimeRecordModel.countActiveEmployees(companyId, summaryFilters),
      TimeRecordModel.getDailySummary(
        companyId,
        selectedDate,
        summaryFilters,
        dailySummaryLimit,
        offsetDailySummary,
      ),
    ]);

    const stats = {
      duplicate: statsOverview?.duplicate || {},
      dashboard: statsOverview?.dashboard || {},
      attendance_logs: statsOverview?.attendance_logs || {},
      cards: {
        total_employees: Number(statsOverview?.duplicate?.total_employees || 0),
        on_time_today: Number(statsOverview?.attendance_logs?.on_time || 0),
        late_today: Number(statsOverview?.duplicate?.late_today || 0),
        absent_today: Number(statsOverview?.duplicate?.absent_today || 0),
      },
    };

    return {
      filters: {
        selected_date: selectedDate,
        start_date: logFilters.start_date,
        end_date: logFilters.end_date,
        department_id: summaryFilters.department_id || null,
        search: summaryFilters.search || "",
        log_type: logFilters.log_type || null,
      },
      stats,
      departments: departments.map((department) => ({
        id: department.id,
        department_name: department.department_name,
      })),
      realtime_logs: {
        logs: logsRows.map((row) => this.mapRealtimeLog(row)),
        meta: {
          total: logsTotal,
          page,
          limit,
          total_pages: Math.max(Math.ceil(logsTotal / limit), 1),
        },
      },
      daily_summary: {
        total: summaryTotal,
        limit: dailySummaryLimit,
        page: pageDailySummary,
        total_pages: Math.max(Math.ceil(summaryTotal / dailySummaryLimit), 1),
        records: summaryRows.map((row) => this.mapDailySummaryRow(row)),
      },
      generated_at: new Date().toISOString(),
    };
  }

  async getEmployeeHistory(companyId, employeeId, query = {}) {
    const employeeIdNumber = Number(employeeId);
    if (!Number.isFinite(employeeIdNumber) || employeeIdNumber <= 0) {
      throw new AppError("employeeId ไม่ถูกต้อง", 400);
    }

    const startDate = this.normalizeDate(
      query.start_date,
      new Date(new Date().setDate(new Date().getDate() - 30))
        .toISOString()
        .slice(0, 10),
    );
    const endDate = this.normalizeDate(
      query.end_date,
      new Date().toISOString().slice(0, 10),
    );

    if (startDate > endDate) {
      throw new AppError("start_date ต้องน้อยกว่าหรือเท่ากับ end_date", 400);
    }

    const employee = await TimeRecordModel.findEmployeeById(
      companyId,
      employeeIdNumber,
    );

    if (!employee) {
      throw new AppError("ไม่พบพนักงานในบริษัทนี้", 404);
    }

    const rows = await TimeRecordModel.getEmployeeHistory(
      companyId,
      employeeIdNumber,
      startDate,
      endDate,
    );

    return {
      employee_id: employeeIdNumber,
      start_date: startDate,
      end_date: endDate,
      history: rows.map((row) => this.mapHistoryRow(row)),
    };
  }
}

module.exports = new TimeRecordService();
