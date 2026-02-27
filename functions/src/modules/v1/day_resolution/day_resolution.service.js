const AppError = require("../../../utils/AppError");
const { normalizeDate } = require("../../../utils/date");
const DayResolutionModel = require("./day_resolution.model");

const WEEKDAY_MAP = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

class DayResolutionService {
  toWeekdayIndex(workDate) {
    const [year, month, day] = String(workDate).split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  parseWeeklyHolidays(value) {
    if (!value) return [];

    let parsed = value;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }

    let source = [];
    if (Array.isArray(parsed)) {
      source = parsed;
    } else if (Array.isArray(parsed?.days)) {
      source = parsed.days;
    }

    return source
      .map((entry) => {
        if (typeof entry === "number") return entry;
        const lower = String(entry).trim().toLowerCase();
        if (/^\d$/.test(lower)) return Number(lower);
        return WEEKDAY_MAP[lower];
      })
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  }

  isWeeklyHoliday(employee, workDate, roster) {
    if (
      roster?.base_day_type &&
      String(roster.base_day_type).toLowerCase().includes("weekly")
    ) {
      return true;
    }

    const weeklyDays = this.parseWeeklyHolidays(employee.weekly_holidays);
    if (weeklyDays.length === 0) {
      return false;
    }

    const dayIndex = this.toWeekdayIndex(workDate);
    return weeklyDays.includes(dayIndex);
  }

  resolveBaseDayStatus(daySource, employee, roster, workDate) {
    const context = {
      leaveStatus: String(roster?.leave_status || "none").toLowerCase(),
      isHolidaySwap: Number(roster?.is_holiday_swap || 0) === 1,
      isPublicHoliday: Number(roster?.is_public_holiday || 0) === 1,
      isCompensatory: Number(roster?.is_compensatory || 0) === 1,
      weeklyHoliday: this.isWeeklyHoliday(employee, workDate, roster),
    };

    return daySource === "leave_hub"
      ? this.resolveIntegratedBaseDay(context)
      : this.resolveLocalBaseDay(context);
  }

  resolveIntegratedBaseDay(context) {
    if (context.leaveStatus !== "none") {
      return {
        status: "leave",
        reason: `leave_status=${context.leaveStatus}`,
      };
    }

    if (context.isHolidaySwap) {
      return {
        status: "holiday_swap",
        reason: "is_holiday_swap=1",
      };
    }

    if (context.isPublicHoliday && context.isCompensatory) {
      return {
        status: "compensatory_holiday",
        reason: "is_public_holiday=1,is_compensatory=1",
      };
    }

    if (context.isPublicHoliday) {
      return {
        status: "public_holiday",
        reason: "is_public_holiday=1",
      };
    }

    if (context.weeklyHoliday) {
      return {
        status: "weekly_holiday",
        reason: "weekly_holiday_match",
      };
    }

    return {
      status: "working_day",
      reason: "default_working_day",
    };
  }

  resolveLocalBaseDay(context) {
    if (context.leaveStatus !== "none") {
      return {
        status: "leave",
        reason: `roster_override:leave_status=${context.leaveStatus}`,
      };
    }

    if (context.isHolidaySwap) {
      return {
        status: "holiday_swap",
        reason: "roster_override:is_holiday_swap=1",
      };
    }

    if (context.isPublicHoliday && context.isCompensatory) {
      return {
        status: "compensatory_holiday",
        reason: "roster_override:public_holiday+compensatory",
      };
    }

    if (context.isPublicHoliday) {
      return {
        status: "public_holiday",
        reason: "roster_override:is_public_holiday=1",
      };
    }

    if (context.weeklyHoliday) {
      return {
        status: "weekly_holiday",
        reason: "weekly_holiday_match",
      };
    }

    return {
      status: "working_day",
      reason: "default_working_day",
    };
  }

  buildShiftPayload(shift, mode, source) {
    return {
      mode,
      source,
      shift_id: shift.id,
      name: shift.name,
      type: shift.type,
      start_time: shift.start_time,
      end_time: shift.end_time,
      is_break: shift.is_break,
      break_start_time: shift.break_start_time,
      break_end_time: shift.break_end_time,
      is_night_shift: shift.is_night_shift,
    };
  }

  async resolveEffectiveShift(companyId, employee, roster) {
    const mode = String(employee.shift_mode || "normal").toLowerCase();

    if (mode === "custom") {
      if (!roster?.shift_id) {
        throw new AppError(
          "SHIFT_NOT_ASSIGNED: ไม่พบกะงานจาก roster สำหรับพนักงานโหมด custom",
          422,
        );
      }

      if (roster.roster_shift_name) {
        return this.buildShiftPayload(
          {
            id: roster.shift_id,
            name: roster.roster_shift_name,
            type: roster.roster_shift_type,
            start_time: roster.roster_shift_start_time,
            end_time: roster.roster_shift_end_time,
            is_break: roster.roster_shift_is_break,
            break_start_time: roster.roster_shift_break_start_time,
            break_end_time: roster.roster_shift_break_end_time,
            is_night_shift: roster.roster_shift_is_night_shift,
          },
          "custom",
          "roster",
        );
      }

      const shift = await DayResolutionModel.findShiftById(
        companyId,
        roster.shift_id,
      );
      if (!shift) {
        throw new AppError(
          "SHIFT_NOT_FOUND: ไม่พบข้อมูลกะงานที่ถูกอ้างอิงจาก roster",
          404,
        );
      }

      return this.buildShiftPayload(shift, "custom", "roster");
    }

    if (!employee.default_shift_id) {
      throw new AppError(
        "DEFAULT_SHIFT_MISSING: พนักงานโหมด normal แต่ไม่มีกะงานเริ่มต้น",
        422,
      );
    }

    const defaultShift = await DayResolutionModel.findShiftById(
      companyId,
      employee.default_shift_id,
    );

    if (!defaultShift) {
      throw new AppError(
        "SHIFT_NOT_FOUND: ไม่พบข้อมูล default shift ของพนักงาน",
        404,
      );
    }

    return this.buildShiftPayload(defaultShift, "normal", "employee_default");
  }

  async getEmployeeDayResolution(companyId, employeeId, dateInput) {
    const workDate = normalizeDate(dateInput);
    if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      throw new AppError(
        "INVALID_DATE_FORMAT: วันที่ไม่ถูกต้อง กรุณาระบุรูปแบบ YYYY-MM-DD",
        400,
      );
    }

    const employee = await DayResolutionModel.findEmployeeContext(
      companyId,
      employeeId,
    );

    if (!employee) {
      throw new AppError("EMPLOYEE_NOT_FOUND: ไม่พบพนักงานในบริษัทนี้", 404);
    }

    const roster = await DayResolutionModel.findRosterByEmployeeAndDate(
      companyId,
      employeeId,
      workDate,
    );

    const daySource = employee.leave_hub_company_id ? "leave_hub" : "local";
    const baseDay = this.resolveBaseDayStatus(
      daySource,
      employee,
      roster,
      workDate,
    );
    const effectiveShift = await this.resolveEffectiveShift(
      companyId,
      employee,
      roster,
    );

    return {
      company_id: Number(companyId),
      employee_id: Number(employeeId),
      work_date: workDate,
      day_source: daySource,
      base_day_status: baseDay.status,
      base_day_reason: baseDay.reason,
      effective_shift: effectiveShift,
      flags: {
        is_public_holiday: Number(roster?.is_public_holiday || 0) === 1,
        is_compensatory: Number(roster?.is_compensatory || 0) === 1,
        is_holiday_swap: Number(roster?.is_holiday_swap || 0) === 1,
        leave_status: String(roster?.leave_status || "none"),
      },
      roster_id: roster?.id || null,
      resolved_at: new Date().toISOString(),
    };
  }

  async getCompanyDaySnapshots(companyId, dateInput, employeeId = null) {
    const workDate = normalizeDate(dateInput);
    if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      throw new AppError(
        "INVALID_DATE_FORMAT: วันที่ไม่ถูกต้อง กรุณาระบุรูปแบบ YYYY-MM-DD",
        400,
      );
    }

    const employees = await DayResolutionModel.findActiveEmployeesByCompany(
      companyId,
      employeeId,
    );

    if (!employees || employees.length === 0) {
      return [];
    }

    const snapshots = await Promise.all(
      employees.map((employee) =>
        this.getEmployeeDayResolution(companyId, employee.id, workDate),
      ),
    );

    return snapshots;
  }
}

module.exports = new DayResolutionService();
