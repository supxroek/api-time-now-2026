const axios = require("axios");
const crypto = require("node:crypto");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");
const db = require("../../config/db.config");
const LeaveHubIntegrationModel = require("./leaveHubIntegration.model");

const {
  LEAVE_HUB_LOGIN_URL = "https://apiv2-tnlncwsaha-as.a.run.app/login",
  LEAVE_HUB_LEAVE_REQUEST_URL = "https://apiv2-tnlncwsaha-as.a.run.app/leave_request",
  LEAVE_HUB_LEAVE_TYPE_URL = "https://apiv2-tnlncwsaha-as.a.run.app/leaveType",
  LEAVE_HUB_SWAP_REQUEST_URL = "https://apiv2-tnlncwsaha-as.a.run.app/swap_request",
  LEAVE_HUB_STAFF_URL = "https://apiv2-tnlncwsaha-as.a.run.app/staff/staff",
  LEAVE_HUB_CUSTOM_DAYOFF_URL = "https://apiv2-tnlncwsaha-as.a.run.app/customDayoff/all",
  LEAVE_HUB_HOLIDAYS_URL = "https://apiv2-tnlncwsaha-as.a.run.app/holiday",
  LEAVE_HUB_CREDENTIAL_SECRET,
} = process.env;

class LeaveHubIntegrationService {
  static WEEKDAY_MAP = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };

  static THAI_MONTH_MAP = {
    มกราคม: 1,
    กุมภาพันธ์: 2,
    มีนาคม: 3,
    เมษายน: 4,
    พฤษภาคม: 5,
    มิถุนายน: 6,
    กรกฎาคม: 7,
    สิงหาคม: 8,
    กันยายน: 9,
    ตุลาคม: 10,
    พฤศจิกายน: 11,
    ธันวาคม: 12,
  };

  buildIntegrationState({
    companyId,
    leaveHubCompanyId,
    lastSyncTime,
    token,
    syncedPayload,
    connected,
    reconciliationSummary,
  }) {
    return {
      company_id: Number(companyId) || null,
      day_source: connected ? "leave_hub" : "local",
      connection_status: connected ? "connected" : "not_connected",
      leave_hub_company_id: leaveHubCompanyId
        ? Number(leaveHubCompanyId)
        : null,
      last_sync_time: lastSyncTime || null,
      has_token: Boolean(token),
      token: token || null,
      synced_payload: syncedPayload || null,
      reconciliation_summary: reconciliationSummary || null,
    };
  }

  normalizePassportValue(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized || null;
  }

  toDateString(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  parseWeeklyDays(dayOffValue) {
    if (!dayOffValue) return new Set();

    const normalizeToken = (token) =>
      String(token)
        .trim()
        .toLowerCase()
        .replaceAll("[", "")
        .replaceAll("]", "")
        .replaceAll('"', "")
        .replaceAll("'", "")
        .replaceAll("วัน", "")
        .trim();

    const values = Array.isArray(dayOffValue)
      ? dayOffValue
      : String(dayOffValue).split(/[,;|]/);

    const result = new Set();
    values.forEach((rawValue) => {
      const token = normalizeToken(rawValue);
      if (!token) return;

      if (/^\d+$/.test(token)) {
        const numeric = Number(token);
        if (numeric >= 0 && numeric <= 6) result.add(numeric);
        if (numeric === 7) result.add(0);
        return;
      }

      const mapped = LeaveHubIntegrationService.WEEKDAY_MAP[token];
      if (mapped !== undefined) {
        result.add(mapped);
      }
    });

    return result;
  }

  parseTimeNowWeeklyHolidayRules(value) {
    const weekDays = new Set();
    const customDates = new Set();

    if (!value) {
      return { weekDays, customDates };
    }

    let parsed = value;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = parsed
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    if (!Array.isArray(parsed)) {
      return { weekDays, customDates };
    }

    parsed.forEach((item) => {
      const token = String(item).trim();
      if (!token) return;

      if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
        customDates.add(token);
        return;
      }

      if (/^\d+$/.test(token)) {
        const day = Number(token);
        if (day >= 0 && day <= 6) weekDays.add(day);
        if (day === 7) weekDays.add(0);
      }
    });

    return { weekDays, customDates };
  }

  collectDateRange(leavePayload) {
    const dates = new Set();

    const pushDate = (value) => {
      const date = this.toDateString(value);
      if (date) dates.add(date);
    };

    const leaveRequests = Array.isArray(leavePayload?.leave_requests)
      ? leavePayload.leave_requests
      : [];
    const swapRequests = Array.isArray(leavePayload?.swap_requests)
      ? leavePayload.swap_requests
      : [];
    const customDayoffs = Array.isArray(leavePayload?.custom_dayoffs)
      ? leavePayload.custom_dayoffs
      : [];

    leaveRequests.forEach((item) => {
      pushDate(item?.start_date);
      pushDate(item?.end_date);
    });

    swapRequests.forEach((item) => {
      pushDate(item?.new_date);
      pushDate(item?.original_date);
    });

    customDayoffs.forEach((item) => {
      if (Array.isArray(item?.off_dates)) {
        item.off_dates.forEach((date) => pushDate(date));
      }
      pushDate(item?.off_date);
      pushDate(item?.date);
    });

    if (dates.size === 0) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      };
    }

    const sorted = Array.from(dates).sort((a, b) => a.localeCompare(b));
    return {
      startDate: sorted[0],
      endDate: sorted.at(-1),
    };
  }

  parseThaiHolidayDate(textDate, year) {
    if (!textDate) return null;
    const match = /^(\d{1,2})\s+([ก-๙]+)$/.exec(String(textDate).trim());
    if (!match) return null;

    const day = Number(match[1]);
    const month = LeaveHubIntegrationService.THAI_MONTH_MAP[match[2]];
    if (!day || !month) return null;

    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toISOString().slice(0, 10);
  }

  isValidIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  resolveRosterContextRange(query = {}) {
    if (query?.start_date && !this.isValidIsoDate(query.start_date)) {
      throw new AppError(
        "วันที่ start_date ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD",
        400,
        "INVALID_DATE_FORMAT",
      );
    }

    if (query?.end_date && !this.isValidIsoDate(query.end_date)) {
      throw new AppError(
        "วันที่ end_date ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD",
        400,
        "INVALID_DATE_FORMAT",
      );
    }

    if (query?.month && !/^\d{4}-\d{2}$/.test(String(query.month))) {
      throw new AppError(
        "รูปแบบเดือนต้องเป็น YYYY-MM",
        400,
        "INVALID_DATE_FORMAT",
      );
    }

    if (query?.start_date && query?.end_date) {
      return {
        startDate: query.start_date,
        endDate: query.end_date,
      };
    }

    const month = query?.month || new Date().toISOString().slice(0, 7);
    const [year, monthIndex] = String(month).split("-").map(Number);

    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 0));

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  getEventPriority(type) {
    const priorityMap = {
      LEAVE: 1,
      HOLIDAY_SWAP: 2,
      HOLIDAY_COMPENSATION: 3,
      HOLIDAY: 4,
      WEEKLY_HOLIDAY: 5,
    };

    return priorityMap[type] || 999;
  }

  setEventWithPriority(map, key, eventPayload) {
    const current = map.get(key);
    if (!current) {
      map.set(key, eventPayload);
      return;
    }

    if (eventPayload.priority <= current.priority) {
      map.set(key, eventPayload);
    }
  }

  buildLeaveHubRosterContext(payload, employeeMap, startDate, endDate) {
    const eventsByEmployeeDate = new Map();
    const globalEventsByDate = new Map();

    const leaveTypes = Array.isArray(payload?.leave_types)
      ? payload.leave_types
      : [];
    const leaveTypeMap = leaveTypes.reduce((acc, item) => {
      if (item?.id == null) return acc;
      acc[String(item.id)] = item?.name || null;
      return acc;
    }, {});

    const leaveRequests = Array.isArray(payload?.leave_requests)
      ? payload.leave_requests
      : [];
    leaveRequests.forEach((item) => {
      if (!this.isLeaveApproved(item)) return;

      const leaveHubEmployeeId = this.getLeaveHubEmployeeId(item);
      const employee = employeeMap.byLeaveHubEmployeeId.get(leaveHubEmployeeId);
      if (!employee) return;

      const start = this.toDateString(item.start_date);
      const end = this.toDateString(item.end_date) || start;
      if (!start || !end) return;

      const leaveTypeName = leaveTypeMap[String(item.leave_type_id)] || null;
      this.expandDateRange(start, end).forEach((dateStr) => {
        if (dateStr < startDate || dateStr > endDate) return;

        const key = `${employee.id}|${dateStr}`;
        this.setEventWithPriority(eventsByEmployeeDate, key, {
          employee_id: employee.id,
          work_date: dateStr,
          type: "LEAVE",
          priority: this.getEventPriority("LEAVE"),
          details: {
            leave_type_name: leaveTypeName,
            status: item.status,
            reason: item.reason || null,
            start_date: item.start_date,
            end_date: item.end_date,
            days_requested: item.days_requested,
            hours_requested: item.hours_requested,
            start_time: item.start_time,
            end_time: item.end_time,
            leave_request_id: item.id,
          },
        });
      });
    });

    const swapRequests = Array.isArray(payload?.swap_requests)
      ? payload.swap_requests
      : [];
    swapRequests.forEach((item) => {
      if (!this.isSwapApproved(item)) return;

      const leaveHubEmployeeId = this.getLeaveHubEmployeeId(item);
      const employee = employeeMap.byLeaveHubEmployeeId.get(leaveHubEmployeeId);
      if (!employee) return;

      const dateStr = this.toDateString(item.new_date);
      if (!dateStr || dateStr < startDate || dateStr > endDate) return;

      const key = `${employee.id}|${dateStr}`;
      this.setEventWithPriority(eventsByEmployeeDate, key, {
        employee_id: employee.id,
        work_date: dateStr,
        type: "HOLIDAY_SWAP",
        priority: this.getEventPriority("HOLIDAY_SWAP"),
        details: {
          holiday_name: item.holiday_name || null,
          postpone_name: item.postpone_name || null,
          original_date: item.original_date || null,
          new_date: item.new_date || null,
          status: item.status || null,
          reason: item.reason || null,
          swap_request_id: item.id,
        },
      });
    });

    const customDayoffs = Array.isArray(payload?.custom_dayoffs)
      ? payload.custom_dayoffs
      : [];
    customDayoffs.forEach((item) => {
      const leaveHubEmployeeId = this.getLeaveHubEmployeeId(item);
      const employee = employeeMap.byLeaveHubEmployeeId.get(leaveHubEmployeeId);
      if (!employee) return;

      const offDates = Array.isArray(item.off_dates) ? item.off_dates : [];
      offDates.forEach((dateValue) => {
        const dateStr = this.toDateString(dateValue);
        if (!dateStr || dateStr < startDate || dateStr > endDate) return;

        const key = `${employee.id}|${dateStr}`;
        this.setEventWithPriority(eventsByEmployeeDate, key, {
          employee_id: employee.id,
          work_date: dateStr,
          type: "WEEKLY_HOLIDAY",
          priority: this.getEventPriority("WEEKLY_HOLIDAY"),
          details: {
            source: "custom_dayoff",
            custom_dayoff_id: item.id,
          },
        });
      });
    });

    const allDatesInRange = this.expandDateRange(startDate, endDate);
    employeeMap.mappedEmployeeIds.forEach((employeeId) => {
      const weekDays =
        employeeMap.weeklyLeaveHubDaysByEmployee.get(Number(employeeId)) ||
        new Set();
      if (weekDays.size === 0) return;

      allDatesInRange.forEach((dateStr) => {
        const weekDay = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
        if (!weekDays.has(weekDay)) return;

        const key = `${employeeId}|${dateStr}`;
        this.setEventWithPriority(eventsByEmployeeDate, key, {
          employee_id: Number(employeeId),
          work_date: dateStr,
          type: "WEEKLY_HOLIDAY",
          priority: this.getEventPriority("WEEKLY_HOLIDAY"),
          details: {
            source: "staff_dayoff",
          },
        });
      });
    });

    const holidays = Array.isArray(payload?.holidays) ? payload.holidays : [];
    const rangeStartYear = Number(startDate.slice(0, 4));
    const rangeEndYear = Number(endDate.slice(0, 4));

    holidays.forEach((holiday) => {
      for (let year = rangeStartYear; year <= rangeEndYear; year += 1) {
        const holidayDate = this.parseThaiHolidayDate(holiday?.date, year);
        if (!holidayDate || holidayDate < startDate || holidayDate > endDate) {
          continue;
        }

        const normalizedType = String(
          holiday?.holiday_type || holiday?.type || "",
        )
          .trim()
          .toLowerCase();
        const isCompensatory =
          Boolean(holiday?.is_compensation) ||
          normalizedType.includes("compensation") ||
          normalizedType.includes("substitute") ||
          normalizedType.includes("ชดเชย");
        const eventType = isCompensatory ? "HOLIDAY_COMPENSATION" : "HOLIDAY";

        this.setEventWithPriority(globalEventsByDate, holidayDate, {
          work_date: holidayDate,
          type: eventType,
          priority: this.getEventPriority(eventType),
          details: {
            holiday_name: holiday?.name || null,
            holiday_date: holidayDate,
            holiday_id: holiday?.id || null,
            source: "holidays",
          },
        });
      }
    });

    return {
      events_by_employee: Array.from(eventsByEmployeeDate.values()).map(
        ({ priority, ...rest }) => rest,
      ),
      global_events: Array.from(globalEventsByDate.values()).map(
        ({ priority, ...rest }) => rest,
      ),
    };
  }

  expandDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return [];
    }

    const result = [];
    for (
      let cursorTime = start.getTime();
      cursorTime <= end.getTime();
      cursorTime += 24 * 60 * 60 * 1000
    ) {
      result.push(new Date(cursorTime).toISOString().slice(0, 10));
    }

    return result;
  }

  isLeaveApproved(leaveRequest) {
    return String(leaveRequest?.status || "").toLowerCase() === "approved";
  }

  isSwapApproved(swapRequest) {
    return String(swapRequest?.status || "").toLowerCase() === "approved";
  }

  getLeaveHubEmployeeId(item) {
    const candidates = [
      item?.employeeId,
      item?.employee_id,
      item?.empId,
      item?.emp_id,
      item?.staffId,
      item?.staff_id,
      item?.userId,
      item?.user_id,
      item?.id,
    ];

    const found = candidates.find(
      (value) => value !== null && value !== undefined,
    );
    if (found === null || found === undefined) return null;

    const numeric = Number(found);
    return Number.isFinite(numeric) ? numeric : null;
  }

  getLeaveStatusFromRequest(leaveRequest) {
    const hours = Number(leaveRequest?.hours_requested || 0);
    if (hours > 0) return "hourly";
    return "full_day";
  }

  buildLeaveHubEmployeeMap(companyEmployees, leaveHubPayload) {
    const staffs = Array.isArray(leaveHubPayload?.staffs)
      ? leaveHubPayload.staffs
      : [];

    const staffByPassport = new Map();
    const staffById = new Map();
    staffs.forEach((staff) => {
      const passport = this.normalizePassportValue(
        staff?.ID_or_Passport_Number,
      );
      if (passport) {
        staffByPassport.set(passport, staff);
      }
      if (staff?.id != null) {
        staffById.set(Number(staff.id), staff);
      }
    });

    const byLeaveHubEmployeeId = new Map();
    const mappedEmployeeIds = new Set();
    const weeklyLeaveHubDaysByEmployee = new Map();

    companyEmployees.forEach((employee) => {
      const passport = this.normalizePassportValue(
        employee?.id_or_passport_number,
      );
      const staff = passport
        ? staffByPassport.get(passport) || staffById.get(Number(employee.id))
        : staffById.get(Number(employee.id));

      if (!staff?.id) {
        return;
      }

      const leaveHubEmployeeId = Number(staff.id);
      byLeaveHubEmployeeId.set(leaveHubEmployeeId, employee);
      mappedEmployeeIds.add(Number(employee.id));
      weeklyLeaveHubDaysByEmployee.set(
        Number(employee.id),
        this.parseWeeklyDays(staff.dayOff),
      );
    });

    return {
      byLeaveHubEmployeeId,
      mappedEmployeeIds,
      weeklyLeaveHubDaysByEmployee,
    };
  }

  async reconcileLeaveHubToRosters(companyId, leaveHubPayload) {
    const employees =
      await LeaveHubIntegrationModel.findEmployeesForLeaveHubMapping(companyId);

    const employeeMap = this.buildLeaveHubEmployeeMap(
      employees,
      leaveHubPayload,
    );
    const employeeIds = Array.from(employeeMap.mappedEmployeeIds);

    if (employeeIds.length === 0) {
      return {
        mapped_employees: 0,
        updated_rosters: 0,
        skipped_without_shift: 0,
        range: null,
      };
    }

    const { startDate, endDate } = this.collectDateRange(leaveHubPayload);
    const existingRosters =
      await LeaveHubIntegrationModel.findRostersByEmployeesAndDateRange(
        companyId,
        employeeIds,
        startDate,
        endDate,
      );

    const rosterMap = new Map();
    existingRosters.forEach((row) => {
      rosterMap.set(
        `${row.employee_id}|${String(row.work_date).slice(0, 10)}`,
        row,
      );
    });

    const leaveIndex = new Map();
    const swapIndex = new Map();
    const customDayoffSet = new Set();
    const holidayIndex = new Map();

    const leaveRequests = Array.isArray(leaveHubPayload?.leave_requests)
      ? leaveHubPayload.leave_requests
      : [];
    leaveRequests.forEach((item) => {
      if (!this.isLeaveApproved(item)) return;

      const leaveHubEmployeeId = this.getLeaveHubEmployeeId(item);
      const employee = employeeMap.byLeaveHubEmployeeId.get(leaveHubEmployeeId);
      if (!employee) return;

      const start = this.toDateString(item.start_date);
      const end = this.toDateString(item.end_date) || start;
      if (!start || !end) return;

      const leaveStatus = this.getLeaveStatusFromRequest(item);
      this.expandDateRange(start, end).forEach((dateStr) => {
        const key = `${employee.id}|${dateStr}`;
        const current = leaveIndex.get(key);
        const next = {
          leave_status: leaveStatus,
          leave_hours_data:
            leaveStatus === "hourly"
              ? {
                  hours_requested: item.hours_requested || null,
                  start_time: item.start_time || null,
                  end_time: item.end_time || null,
                  leave_type_id: item.leave_type_id || null,
                  leave_request_id: item.id || null,
                }
              : null,
        };

        if (
          !current ||
          (current.leave_status === "hourly" && leaveStatus === "full_day")
        ) {
          leaveIndex.set(key, next);
        }
      });
    });

    const swapRequests = Array.isArray(leaveHubPayload?.swap_requests)
      ? leaveHubPayload.swap_requests
      : [];
    swapRequests.forEach((item) => {
      if (!this.isSwapApproved(item)) return;

      const leaveHubEmployeeId = this.getLeaveHubEmployeeId(item);
      const employee = employeeMap.byLeaveHubEmployeeId.get(leaveHubEmployeeId);
      if (!employee) return;

      const targetDate = this.toDateString(item.new_date);
      if (!targetDate) return;
      swapIndex.set(`${employee.id}|${targetDate}`, true);
    });

    const customDayoffs = Array.isArray(leaveHubPayload?.custom_dayoffs)
      ? leaveHubPayload.custom_dayoffs
      : [];
    customDayoffs.forEach((item) => {
      const leaveHubEmployeeId = this.getLeaveHubEmployeeId(item);
      const employee = employeeMap.byLeaveHubEmployeeId.get(leaveHubEmployeeId);
      if (!employee) return;

      const offDates = Array.isArray(item.off_dates) ? item.off_dates : [];
      offDates.forEach((offDate) => {
        const dateStr = this.toDateString(offDate);
        if (dateStr) {
          customDayoffSet.add(`${employee.id}|${dateStr}`);
        }
      });
    });

    const rangeStartYear = Number(startDate.slice(0, 4));
    const rangeEndYear = Number(endDate.slice(0, 4));
    const holidays = Array.isArray(leaveHubPayload?.holidays)
      ? leaveHubPayload.holidays
      : [];
    holidays.forEach((holiday) => {
      for (let year = rangeStartYear; year <= rangeEndYear; year += 1) {
        const dateStr = this.parseThaiHolidayDate(holiday?.date, year);
        if (!dateStr) continue;
        if (dateStr < startDate || dateStr > endDate) continue;

        holidayIndex.set(dateStr, {
          is_public_holiday: 1,
          is_compensatory: 0,
          base_day_type: "public_holiday",
        });
      }
    });

    const rowsToUpsert = [];
    let skippedWithoutShift = 0;

    const allDates = this.expandDateRange(startDate, endDate);
    employeeIds.forEach((employeeId) => {
      const employee = employees.find(
        (item) => Number(item.id) === Number(employeeId),
      );
      if (!employee) return;

      const leaveHubWeekDays =
        employeeMap.weeklyLeaveHubDaysByEmployee.get(Number(employee.id)) ||
        new Set();

      allDates.forEach((dateStr) => {
        const key = `${employee.id}|${dateStr}`;
        const existing = rosterMap.get(key);
        const shiftId = existing?.shift_id || employee.default_shift_id;
        if (!shiftId) {
          skippedWithoutShift += 1;
          return;
        }

        let baseDayType = "working_day";
        let leaveStatus = "none";
        let leaveHoursData = null;
        let isHolidaySwap = 0;
        let isPublicHoliday = 0;
        let isCompensatory = 0;

        const leaveData = leaveIndex.get(key);
        if (leaveData) {
          baseDayType = "leave";
          leaveStatus = leaveData.leave_status;
          leaveHoursData = leaveData.leave_hours_data;
        } else if (swapIndex.get(key)) {
          baseDayType = "holiday_swap";
          isHolidaySwap = 1;
        } else if (holidayIndex.get(dateStr)) {
          const holidayData = holidayIndex.get(dateStr);
          baseDayType = holidayData.base_day_type;
          isPublicHoliday = holidayData.is_public_holiday;
          isCompensatory = holidayData.is_compensatory;
        } else {
          const weekDay = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
          const isWeeklyHoliday =
            customDayoffSet.has(key) || leaveHubWeekDays.has(weekDay);

          if (isWeeklyHoliday) {
            baseDayType = "weekly_holiday";
          }
        }

        const hash = crypto
          .createHash("sha256")
          .update(
            JSON.stringify({
              employee_id: employee.id,
              date: dateStr,
              base_day_type: baseDayType,
              leave_status: leaveStatus,
              is_holiday_swap: isHolidaySwap,
              is_public_holiday: isPublicHoliday,
              is_compensatory: isCompensatory,
              leave_hours_data: leaveHoursData,
            }),
          )
          .digest("hex");

        rowsToUpsert.push({
          company_id: companyId,
          employee_id: employee.id,
          shift_id: Number(shiftId),
          work_date: dateStr,
          is_ot_allowed: Number(existing?.is_ot_allowed || 0),
          is_public_holiday: isPublicHoliday,
          leave_status: leaveStatus,
          leave_hours_data: leaveHoursData,
          is_holiday_swap: isHolidaySwap,
          is_compensatory: isCompensatory,
          source_system: "leave_hub",
          base_day_type: baseDayType,
          source_payload_hash: hash,
          sync_version: Number(existing?.sync_version || 1),
        });
      });
    });

    const tx = await db.getConnection();

    try {
      await tx.beginTransaction();

      for (const row of rowsToUpsert) {
        await LeaveHubIntegrationModel.upsertRosterSnapshot(row, tx);
      }

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.release();
    }

    return {
      mapped_employees: employeeIds.length,
      updated_rosters: rowsToUpsert.length,
      skipped_without_shift: skippedWithoutShift,
      range: {
        start_date: startDate,
        end_date: endDate,
      },
    };
  }

  getCredentialEncryptionKey() {
    if (!LEAVE_HUB_CREDENTIAL_SECRET) {
      throw new AppError(
        "ยังไม่ได้ตั้งค่า LEAVE_HUB_CREDENTIAL_SECRET สำหรับเข้ารหัสข้อมูล",
        500,
        "LEAVEHUB_CONFIG_MISSING",
      );
    }

    return crypto
      .createHash("sha256")
      .update(LEAVE_HUB_CREDENTIAL_SECRET)
      .digest();
  }

  encryptCredential(plainText) {
    if (!plainText) {
      return null;
    }

    const key = this.getCredentialEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
      cipher.update(String(plainText), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
    return `enc:v1:${payload}`;
  }

  decryptCredential(cipherText) {
    if (!cipherText) {
      return null;
    }

    if (!String(cipherText).startsWith("enc:v1:")) {
      return cipherText;
    }

    const payload = Buffer.from(
      String(cipherText).replace("enc:v1:", ""),
      "base64",
    );
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);

    const key = this.getCredentialEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }

  maskSecret(value) {
    return value ? "***" : null;
  }

  formatDateTimeForDb(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  // ==============================================================
  // เรียก Login กับ LeaveHub เพื่อขอข้อมูล session ล่าสุด
  async loginToLeaveHub(username, password) {
    try {
      const response = await axios.post(
        LEAVE_HUB_LOGIN_URL,
        { username, password },
        { timeout: 15000 },
      );

      const payload = response.data?.data || response.data || {};
      const token =
        payload.token ||
        payload.accessToken ||
        payload.access_token ||
        payload.jwt;
      const leaveHubCompanyId = payload.companyId || payload.company_id;

      if (!token) {
        throw new AppError(
          "LeaveHub ไม่ส่ง Token กลับมา",
          502,
          "LEAVEHUB_API_UNAVAILABLE",
        );
      }

      return {
        token,
        leaveHubCompanyId,
        raw: payload,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const statusCode = error.response?.status || 502;
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "username หรือ password ไม่ถูกต้อง";

      const errorCode =
        statusCode === 401 || statusCode === 403
          ? "LEAVEHUB_AUTH_FAILED"
          : "LEAVEHUB_API_UNAVAILABLE";

      throw new AppError(message, statusCode, errorCode, {
        upstream_status: statusCode,
      });
    }
  }

  // ==============================================================
  // เชื่อมต่อ LeaveHub ครั้งแรกและบันทึก credential ลงฐานข้อมูล
  async connectLeaveHub(user, payload, ipAddress) {
    const { company_id: requestedCompanyId, username, password } = payload;

    if (!requestedCompanyId || !username || !password) {
      throw new AppError(
        "กรุณาระบุ company_id, username และ password",
        400,
        "INVALID_REQUEST_PAYLOAD",
      );
    }

    if (Number(requestedCompanyId) !== Number(user.company_id)) {
      throw new AppError(
        "ไม่สามารถเชื่อมต่อข้ามบริษัทได้",
        403,
        "CROSS_TENANT_ACCESS_DENIED",
      );
    }

    const company =
      await LeaveHubIntegrationModel.findCompanyLeaveHubCredentials(
        requestedCompanyId,
      );

    if (!company) {
      throw new AppError(
        "ไม่พบบริษัทที่ต้องการเชื่อมต่อ",
        404,
        "COMPANY_NOT_FOUND",
      );
    }

    const loginResult = await this.loginToLeaveHub(username, password);
    const leaveHubCompanyId = Number(
      loginResult.leaveHubCompanyId || company.leave_hub_company_id,
    );

    if (!leaveHubCompanyId) {
      throw new AppError(
        "LeaveHub ไม่ส่ง companyId ที่ใช้งานได้",
        502,
        "LEAVEHUB_API_UNAVAILABLE",
      );
    }

    const newIntegration = {
      leave_hub_company_id: leaveHubCompanyId,
      leave_hub_username: username,
      leave_hub_password: this.encryptCredential(password),
      last_sync_time: this.formatDateTimeForDb(new Date()),
    };

    await LeaveHubIntegrationModel.updateLeaveHubCredentials(
      requestedCompanyId,
      newIntegration,
    );

    await auditRecord({
      userId: user.id,
      companyId: requestedCompanyId,
      action: "UPDATE",
      table: "companies",
      recordId: requestedCompanyId,
      oldVal: {
        leave_hub_company_id: company.leave_hub_company_id,
        leave_hub_username: company.leave_hub_username,
        leave_hub_password: this.maskSecret(company.leave_hub_password),
      },
      newVal: {
        leave_hub_company_id: newIntegration.leave_hub_company_id,
        leave_hub_username: newIntegration.leave_hub_username,
        leave_hub_password: this.maskSecret(newIntegration.leave_hub_password),
        last_sync_time: newIntegration.last_sync_time,
      },
      ipAddress,
    });

    // ดึงข้อมูลทันทีหลัง login สำเร็จ
    const syncPayload = await this.fetchLeaveHubSyncData(
      loginResult.token,
      leaveHubCompanyId,
    );
    const reconciliationSummary = await this.reconcileLeaveHubToRosters(
      requestedCompanyId,
      syncPayload,
    );

    return this.buildIntegrationState({
      companyId: requestedCompanyId,
      leaveHubCompanyId,
      lastSyncTime: newIntegration.last_sync_time,
      token: loginResult.token,
      syncedPayload: syncPayload,
      connected: true,
      reconciliationSummary,
    });
  }

  // ==============================================================
  // ดึง token ใหม่จาก credential ที่เก็บไว้
  async getFreshToken(companyId) {
    const company =
      await LeaveHubIntegrationModel.findCompanyLeaveHubCredentials(companyId);

    if (!company) {
      throw new AppError("ไม่พบบริษัท", 404, "COMPANY_NOT_FOUND");
    }

    if (!company.leave_hub_username || !company.leave_hub_password) {
      throw new AppError(
        "บริษัทยังไม่ได้เชื่อมต่อ LeaveHub",
        400,
        "LEAVEHUB_NOT_CONNECTED",
      );
    }

    const decryptedPassword = this.decryptCredential(
      company.leave_hub_password,
    );

    const loginResult = await this.loginToLeaveHub(
      company.leave_hub_username,
      decryptedPassword,
    );

    return {
      token: loginResult.token,
      leave_hub_company_id:
        loginResult.leaveHubCompanyId || company.leave_hub_company_id,
    };
  }

  filterByCompany(items, companyId) {
    if (!Array.isArray(items)) {
      return items;
    }

    const targetCompanyId = Number(companyId);
    return items.filter((item) => Number(item?.companyId) === targetCompanyId);
  }

  // ==============================================================
  // ดึงข้อมูล LeaveHub ที่ใช้สำหรับซิงก์
  async fetchLeaveHubSyncData(token, leaveHubCompanyId) {
    if (
      !LEAVE_HUB_LEAVE_REQUEST_URL &&
      !LEAVE_HUB_LEAVE_TYPE_URL &&
      !LEAVE_HUB_SWAP_REQUEST_URL &&
      !LEAVE_HUB_STAFF_URL &&
      !LEAVE_HUB_CUSTOM_DAYOFF_URL &&
      !LEAVE_HUB_HOLIDAYS_URL
    ) {
      return null;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    let leaveRequestsResponse;
    let leaveTypesResponse;
    let swapRequestsResponse;
    let staffsResponse;
    let customDayoffsResponse;
    let holidaysResponse;

    try {
      [
        leaveRequestsResponse,
        leaveTypesResponse,
        swapRequestsResponse,
        staffsResponse,
        customDayoffsResponse,
        holidaysResponse,
      ] = await Promise.all([
        LEAVE_HUB_LEAVE_REQUEST_URL
          ? axios.get(LEAVE_HUB_LEAVE_REQUEST_URL, { headers, timeout: 15000 })
          : Promise.resolve(null),
        LEAVE_HUB_LEAVE_TYPE_URL
          ? axios.get(LEAVE_HUB_LEAVE_TYPE_URL, { headers, timeout: 15000 })
          : Promise.resolve(null),
        LEAVE_HUB_SWAP_REQUEST_URL
          ? axios.get(LEAVE_HUB_SWAP_REQUEST_URL, { headers, timeout: 15000 })
          : Promise.resolve(null),
        LEAVE_HUB_STAFF_URL
          ? axios.get(LEAVE_HUB_STAFF_URL, { headers, timeout: 15000 })
          : Promise.resolve(null),
        LEAVE_HUB_CUSTOM_DAYOFF_URL
          ? axios.get(LEAVE_HUB_CUSTOM_DAYOFF_URL, { headers, timeout: 15000 })
          : Promise.resolve(null),
        LEAVE_HUB_HOLIDAYS_URL
          ? axios.get(LEAVE_HUB_HOLIDAYS_URL, { headers, timeout: 15000 })
          : Promise.resolve(null),
      ]);
    } catch (error) {
      const upstreamStatus = error?.response?.status || 503;
      throw new AppError(
        "ปลายทาง LeaveHub ใช้งานไม่ได้ กรุณาลองใหม่อีกครั้ง",
        503,
        "LEAVEHUB_API_UNAVAILABLE",
        { upstream_status: upstreamStatus },
      );
    }

    return {
      leave_requests: this.filterByCompany(
        leaveRequestsResponse?.data || null,
        leaveHubCompanyId,
      ),
      leave_types: this.filterByCompany(
        leaveTypesResponse?.data || null,
        leaveHubCompanyId,
      ),
      swap_requests: this.filterByCompany(
        swapRequestsResponse?.data || null,
        leaveHubCompanyId,
      ),
      staffs: this.filterByCompany(
        staffsResponse?.data || null,
        leaveHubCompanyId,
      ),
      custom_dayoffs: this.filterByCompany(
        customDayoffsResponse?.data || null,
        leaveHubCompanyId,
      ),
      holidays: this.filterByCompany(
        holidaysResponse?.data || null,
        leaveHubCompanyId,
      ),
    };
  }

  // ==============================================================
  // ซิงก์ข้อมูลล่าสุด (re-login อัตโนมัติและเตรียม token สำหรับเรียก API ถัดไป)
  async syncLeaveHubData(user, companyId, ipAddress) {
    if (Number(companyId) !== Number(user.company_id)) {
      throw new AppError(
        "ไม่สามารถซิงก์ข้อมูลข้ามบริษัทได้",
        403,
        "CROSS_TENANT_ACCESS_DENIED",
      );
    }

    const company =
      await LeaveHubIntegrationModel.findCompanyLeaveHubCredentials(companyId);

    if (!company) {
      throw new AppError("ไม่พบบริษัท", 404, "COMPANY_NOT_FOUND");
    }

    const freshTokenResult = await this.getFreshToken(companyId);
    const syncPayload = await this.fetchLeaveHubSyncData(
      freshTokenResult.token,
      freshTokenResult.leave_hub_company_id,
    );
    const reconciliationSummary = await this.reconcileLeaveHubToRosters(
      companyId,
      syncPayload,
    );
    const syncAt = this.formatDateTimeForDb(new Date());

    await LeaveHubIntegrationModel.updateLastSyncTime(companyId, syncAt);

    await auditRecord({
      userId: user.id,
      companyId,
      action: "UPDATE",
      table: "companies",
      recordId: companyId,
      oldVal: {
        last_sync_time: company.last_sync_time,
      },
      newVal: {
        leave_hub_company_id: freshTokenResult.leave_hub_company_id,
        sync_status: "success",
        last_sync_time: syncAt,
      },
      ipAddress,
    });

    return this.buildIntegrationState({
      companyId,
      leaveHubCompanyId: freshTokenResult.leave_hub_company_id,
      lastSyncTime: syncAt,
      token: freshTokenResult.token,
      syncedPayload: syncPayload,
      connected: true,
      reconciliationSummary,
    });
  }

  // ==============================================================
  // ยกเลิกการเชื่อมต่อ LeaveHub
  async disconnectLeaveHub(user, companyId, ipAddress) {
    if (Number(companyId) !== Number(user.company_id)) {
      throw new AppError(
        "ไม่สามารถยกเลิกการเชื่อมต่อข้ามบริษัทได้",
        403,
        "CROSS_TENANT_ACCESS_DENIED",
      );
    }

    const company =
      await LeaveHubIntegrationModel.findCompanyLeaveHubCredentials(companyId);

    if (!company) {
      throw new AppError("ไม่พบบริษัท", 404, "COMPANY_NOT_FOUND");
    }

    await LeaveHubIntegrationModel.clearLeaveHubCredentials(companyId);

    await auditRecord({
      userId: user.id,
      companyId,
      action: "UPDATE",
      table: "companies",
      recordId: companyId,
      oldVal: {
        leave_hub_company_id: company.leave_hub_company_id,
        leave_hub_username: company.leave_hub_username,
        leave_hub_password: this.maskSecret(company.leave_hub_password),
        last_sync_time: company.last_sync_time,
      },
      newVal: {
        leave_hub_company_id: null,
        leave_hub_username: null,
        leave_hub_password: null,
        last_sync_time: null,
      },
      ipAddress,
    });

    return this.buildIntegrationState({
      companyId,
      leaveHubCompanyId: null,
      lastSyncTime: null,
      token: null,
      syncedPayload: null,
      connected: false,
    });
  }

  async getRosterContext(user, query) {
    const companyId = Number(user?.company_id);
    const { startDate, endDate } = this.resolveRosterContextRange(query);

    const company =
      await LeaveHubIntegrationModel.findCompanyLeaveHubCredentials(companyId);
    if (!company) {
      throw new AppError("ไม่พบบริษัท", 404, "COMPANY_NOT_FOUND");
    }

    if (!company.leave_hub_company_id) {
      return {
        day_source: "local",
        connection_status: "not_connected",
        range: {
          start_date: startDate,
          end_date: endDate,
        },
        events_by_employee: [],
        global_events: [],
        mapped_employee_count: 0,
        unmapped_staff_count: 0,
      };
    }

    const freshTokenResult = await this.getFreshToken(companyId);
    const syncPayload = await this.fetchLeaveHubSyncData(
      freshTokenResult.token,
      freshTokenResult.leave_hub_company_id,
    );

    const employees =
      await LeaveHubIntegrationModel.findEmployeesForLeaveHubMapping(companyId);
    const employeeMap = this.buildLeaveHubEmployeeMap(employees, syncPayload);

    const targetEmployeeId = query?.employee_id
      ? Number(query.employee_id)
      : null;

    const filteredEmployeeMap = {
      ...employeeMap,
      mappedEmployeeIds: targetEmployeeId
        ? new Set(
            Array.from(employeeMap.mappedEmployeeIds).filter(
              (id) => Number(id) === targetEmployeeId,
            ),
          )
        : employeeMap.mappedEmployeeIds,
    };

    const context = this.buildLeaveHubRosterContext(
      syncPayload,
      filteredEmployeeMap,
      startDate,
      endDate,
    );

    const totalStaffs = Array.isArray(syncPayload?.staffs)
      ? syncPayload.staffs.length
      : 0;

    return {
      day_source: "leave_hub",
      connection_status: "connected",
      range: {
        start_date: startDate,
        end_date: endDate,
      },
      ...context,
      mapped_employee_count: filteredEmployeeMap.mappedEmployeeIds.size,
      unmapped_staff_count: Math.max(
        0,
        totalStaffs - employeeMap.mappedEmployeeIds.size,
      ),
    };
  }
}

module.exports = new LeaveHubIntegrationService();
