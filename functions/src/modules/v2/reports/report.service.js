const AppError = require("../../../utils/AppError");
const ReportModel = require("./report.model");

class ReportService {
  static ATTENDANCE_STATUS_LABELS = {
    present: "มาทำงาน",
    incomplete: "ข้อมูลไม่ครบ",
    absent: "ขาดงาน",
    leave: "ลา",
    holiday: "วันหยุด",
  };

  toNumber(value) {
    return Number(value || 0);
  }

  toPercent(numerator, denominator) {
    if (!denominator) return 0;
    return Number(((numerator / denominator) * 100).toFixed(2));
  }

  minutesToHours(minutes) {
    return Number((this.toNumber(minutes) / 60).toFixed(2));
  }

  mapAttendanceStatus(key) {
    return {
      key,
      label: ReportService.ATTENDANCE_STATUS_LABELS[key] || key,
    };
  }

  getCurrentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const toDateString = (date) => date.toISOString().slice(0, 10);

    return {
      startDate: toDateString(start),
      endDate: toDateString(end),
    };
  }

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

  normalizeLimit(value, fallback = 31, max = 500) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.min(Math.floor(parsed), max);
  }

  normalizeOptionalId(value) {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new AppError("พารามิเตอร์ id ไม่ถูกต้อง", 400);
    }

    return Math.floor(parsed);
  }

  ensureDateRange(startDate, endDate) {
    if (startDate > endDate) {
      throw new AppError("start_date ต้องน้อยกว่าหรือเท่ากับ end_date", 400);
    }
  }

  mapEmployeeInfo(row) {
    return {
      id: row.id,
      company_id: row.company_id,
      employee_code: row.employee_code,
      name: row.name,
      email: row.email,
      image_url: row.image_url,
      department_id: row.department_id,
      department_name: row.department_name,
    };
  }

  mapSummaryMetrics(row) {
    const totalDays = this.toNumber(row?.total_days);
    const totalRequiredWorkdays = this.toNumber(
      row?.total_required_workdays ?? row?.total_days,
    );
    const presentDays = this.toNumber(row?.present_days);

    return {
      total_days: totalRequiredWorkdays,
      total_calendar_days: totalDays,
      total_required_workdays: totalRequiredWorkdays,
      present_days: presentDays,
      absent_days: this.toNumber(row?.absent_days),
      leave_days: this.toNumber(row?.leave_days),
      holiday_days: this.toNumber(row?.holiday_days),
      incomplete_days: this.toNumber(row?.incomplete_days),
      total_work_minutes: this.toNumber(row?.total_work_minutes),
      total_work_hours: this.minutesToHours(row?.total_work_minutes),
      total_ot_minutes: this.toNumber(row?.total_ot_minutes),
      total_ot_hours: this.minutesToHours(row?.total_ot_minutes),
      total_late_minutes: this.toNumber(row?.total_late_minutes),
      total_early_exit_minutes: this.toNumber(row?.total_early_exit_minutes),
      attendance_rate_percent: this.toPercent(
        presentDays,
        totalRequiredWorkdays,
      ),
    };
  }

  mapIndividualDailyRow(row) {
    return {
      work_date: row.work_date,
      attendance_status: this.mapAttendanceStatus(row.attendance_status),
      first_check_in: row.first_check_in,
      break_start_at: row.break_start_at,
      break_end_at: row.break_end_at,
      check_out_at: row.check_out_at,
      ot_in_at: row.ot_in_at,
      ot_out_at: row.ot_out_at,
      last_check_out: row.last_check_out,
      total_work_minutes: this.toNumber(row.total_work_minutes),
      total_work_hours: this.minutesToHours(row.total_work_minutes),
      break_minutes: this.toNumber(row.break_minutes),
      late_minutes: this.toNumber(row.late_minutes),
      early_exit_minutes: this.toNumber(row.early_exit_minutes),
      total_ot_minutes: this.toNumber(row.total_ot_minutes),
      total_ot_hours: this.minutesToHours(row.total_ot_minutes),
      roster: {
        day_type: row.day_type,
        source_system: row.source_system,
      },
      shift: row.shift_id
        ? {
            id: row.shift_id,
            name: row.shift_name,
            start_time: row.shift_start_time,
            end_time: row.shift_end_time,
          }
        : null,
    };
  }

  mapEmployeeSummaryRow(row) {
    const totalRequiredWorkdays = this.toNumber(
      row.total_required_workdays ?? row.total_days,
    );
    const presentDays = this.toNumber(row.present_days);

    return {
      employee: {
        id: row.employee_id,
        employee_code: row.employee_code,
        name: row.employee_name,
        image_url: row.employee_avatar,
        department_id: row.department_id,
        department_name: row.department_name,
      },
      metrics: {
        total_days: totalRequiredWorkdays,
        total_required_workdays: totalRequiredWorkdays,
        total_calendar_days: this.toNumber(row.total_days),
        present_days: presentDays,
        absent_days: this.toNumber(row.absent_days),
        leave_days: this.toNumber(row.leave_days),
        holiday_days: this.toNumber(row.holiday_days),
        incomplete_days: this.toNumber(row.incomplete_days),
        total_work_minutes: this.toNumber(row.total_work_minutes),
        total_work_hours: this.minutesToHours(row.total_work_minutes),
        total_ot_minutes: this.toNumber(row.total_ot_minutes),
        total_ot_hours: this.minutesToHours(row.total_ot_minutes),
        total_late_minutes: this.toNumber(row.total_late_minutes),
        total_early_exit_minutes: this.toNumber(row.total_early_exit_minutes),
        attendance_rate_percent: this.toPercent(
          presentDays,
          totalRequiredWorkdays,
        ),
      },
    };
  }

  mapDailyAttendanceRow(row) {
    const totalEmployees = this.toNumber(row.total_employees);
    const presentCount = this.toNumber(row.present_count);

    return {
      work_date: row.work_date,
      total_employees: totalEmployees,
      present_count: presentCount,
      absent_count: this.toNumber(row.absent_count),
      leave_count: this.toNumber(row.leave_count),
      holiday_count: this.toNumber(row.holiday_count),
      incomplete_count: this.toNumber(row.incomplete_count),
      total_work_minutes: this.toNumber(row.total_work_minutes),
      total_work_hours: this.minutesToHours(row.total_work_minutes),
      total_ot_minutes: this.toNumber(row.total_ot_minutes),
      total_ot_hours: this.minutesToHours(row.total_ot_minutes),
      total_late_minutes: this.toNumber(row.total_late_minutes),
      total_early_exit_minutes: this.toNumber(row.total_early_exit_minutes),
      present_rate_percent: this.toPercent(presentCount, totalEmployees),
    };
  }

  buildCommonFilters(query = {}) {
    const defaultRange = this.getCurrentMonthRange();
    const startDate = this.normalizeDate(
      query.start_date,
      defaultRange.startDate,
    );
    const endDate = this.normalizeDate(query.end_date, defaultRange.endDate);
    this.ensureDateRange(startDate, endDate);

    return {
      startDate,
      endDate,
      page: this.normalizePage(query.page, 1),
      limit: this.normalizeLimit(query.limit, 31, 500),
      departmentId: this.normalizeOptionalId(query.department_id),
      search: query.search?.trim() || "",
    };
  }

  async getIndividualSummary(user, query = {}) {
    const filters = this.buildCommonFilters(query);
    const offset = (filters.page - 1) * filters.limit;

    let employeeId = this.normalizeOptionalId(query.employee_id);
    if (!employeeId) {
      employeeId = await ReportModel.findEmployeeIdByUserId(
        user.company_id,
        user.id,
      );
    }

    if (!employeeId) {
      return {
        contract_version: "v2.reports.individual-summary.2026-03-12",
        report_type: { key: "individual_summary", label: "รายงานรายบุคคล" },
        filters: {
          employee_id: null,
          start_date: filters.startDate,
          end_date: filters.endDate,
          page: filters.page,
          limit: filters.limit,
        },
        employee: null,
        summary: { total_work_minutes: 0, total_ot_minutes: 0 /* etc */ },
        daily_records: {
          total: 0,
          page: filters.page,
          limit: filters.limit,
          items: [],
        },
        generated_at: new Date().toISOString(),
        warning: "ไม่พบพนักงาน กรุณาตรวจสอบ employee_id",
      };
    }

    const employee = await ReportModel.findEmployeeForReport(
      user.company_id,
      employeeId,
    );

    // ใช้ Promise.allSettled แทน Promise.all
    const [aggregateResult, totalResult, rowsResult] = await Promise.allSettled(
      [
        ReportModel.getIndividualAggregate(
          user.company_id,
          employeeId,
          filters.startDate,
          filters.endDate,
        ),
        ReportModel.countIndividualDailyRecords(
          user.company_id,
          employeeId,
          filters.startDate,
          filters.endDate,
        ),
        ReportModel.listIndividualDailyRecords(
          user.company_id,
          employeeId,
          filters.startDate,
          filters.endDate,
          filters.limit,
          offset,
        ),
      ],
    );

    // จัดการผลลัพธ์ที่อาจ fail
    const aggregate =
      aggregateResult.status === "fulfilled" ? aggregateResult.value : {};
    const total = totalResult.status === "fulfilled" ? totalResult.value : 0;
    const rows = rowsResult.status === "fulfilled" ? rowsResult.value : [];

    return {
      contract_version: "v2.reports.individual-summary.2026-03-12",
      report_type: { key: "individual_summary", label: "รายงานรายบุคคล" },
      filters: {
        employee_id: employeeId,
        start_date: filters.startDate,
        end_date: filters.endDate,
        page: filters.page,
        limit: filters.limit,
      },
      employee: employee ? this.mapEmployeeInfo(employee) : null,
      summary: this.mapSummaryMetrics(aggregate),
      daily_records: {
        total,
        page: filters.page,
        limit: filters.limit,
        items: rows.map((row) => this.mapIndividualDailyRow(row)),
      },
      generated_at: new Date().toISOString(),
    };
  }

  async getEmployeeSummary(user, query = {}) {
    const filters = this.buildCommonFilters(query);
    const offset = (filters.page - 1) * filters.limit;

    const dbFilters = {
      departmentId: filters.departmentId,
      search: filters.search,
    };

    const [aggregate, total, rows] = await Promise.all([
      ReportModel.getEmployeeSummaryAggregate(
        user.company_id,
        filters.startDate,
        filters.endDate,
        dbFilters,
      ),
      ReportModel.countEmployeeSummaryRows(
        user.company_id,
        filters.startDate,
        filters.endDate,
        dbFilters,
      ),
      ReportModel.listEmployeeSummaryRows(
        user.company_id,
        filters.startDate,
        filters.endDate,
        filters.limit,
        offset,
        dbFilters,
      ),
    ]);

    return {
      contract_version: "v2.reports.employee-summary.2026-03-12",
      report_type: {
        key: "employee_summary",
        label: "รายงานภาพรวมบริษัท (สรุปรายพนักงาน)",
      },
      filters: {
        start_date: filters.startDate,
        end_date: filters.endDate,
        department_id: filters.departmentId,
        search: filters.search,
        page: filters.page,
        limit: filters.limit,
      },
      summary: {
        ...this.mapSummaryMetrics(aggregate),
        total_employees: this.toNumber(aggregate?.total_employees),
      },
      rows: {
        total,
        page: filters.page,
        limit: filters.limit,
        items: rows.map((row) => this.mapEmployeeSummaryRow(row)),
      },
      generated_at: new Date().toISOString(),
    };
  }

  async getDailyAttendance(user, query = {}) {
    const filters = this.buildCommonFilters(query);
    const offset = (filters.page - 1) * filters.limit;

    const dbFilters = {
      departmentId: filters.departmentId,
      search: filters.search,
    };

    const [aggregate, total, rows] = await Promise.all([
      ReportModel.getDailyAttendanceAggregate(
        user.company_id,
        filters.startDate,
        filters.endDate,
        dbFilters,
      ),
      ReportModel.countDailyAttendanceRows(
        user.company_id,
        filters.startDate,
        filters.endDate,
        dbFilters,
      ),
      ReportModel.listDailyAttendanceRows(
        user.company_id,
        filters.startDate,
        filters.endDate,
        filters.limit,
        offset,
        dbFilters,
      ),
    ]);

    return {
      contract_version: "v2.reports.daily-attendance.2026-03-12",
      report_type: {
        key: "daily_attendance",
        label: "รายงานภาพรวมบริษัท (รายวัน)",
      },
      filters: {
        start_date: filters.startDate,
        end_date: filters.endDate,
        department_id: filters.departmentId,
        search: filters.search,
        page: filters.page,
        limit: filters.limit,
      },
      summary: {
        total_days: this.toNumber(aggregate?.total_days),
        unique_employees: this.toNumber(aggregate?.unique_employees),
        total_records: this.toNumber(aggregate?.total_records),
        present_count: this.toNumber(aggregate?.present_count),
        absent_count: this.toNumber(aggregate?.absent_count),
        leave_count: this.toNumber(aggregate?.leave_count),
        holiday_count: this.toNumber(aggregate?.holiday_count),
        incomplete_count: this.toNumber(aggregate?.incomplete_count),
        total_work_minutes: this.toNumber(aggregate?.total_work_minutes),
        total_ot_minutes: this.toNumber(aggregate?.total_ot_minutes),
        total_late_minutes: this.toNumber(aggregate?.total_late_minutes),
        total_early_exit_minutes: this.toNumber(
          aggregate?.total_early_exit_minutes,
        ),
      },
      rows: {
        total,
        page: filters.page,
        limit: filters.limit,
        items: rows.map((row) => this.mapDailyAttendanceRow(row)),
      },
      generated_at: new Date().toISOString(),
    };
  }
}

module.exports = new ReportService();
