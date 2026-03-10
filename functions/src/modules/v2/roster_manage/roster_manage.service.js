const dayjs = require("dayjs");
const db = require("../../../config/db.config");
const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const RosterManageV2Model = require("./roster_manage.model");

const MODE_TYPES = new Set(["off_days", "shifts"]);
const MUTABLE_DAY_TYPES = new Set(["workday", "weekly_off"]);
const OFFDAY_DELETE_TOKEN = "__offday_delete__";

class RosterManageV2Service {
  resolveModeType(modeType = "off_days") {
    const normalized = String(modeType || "off_days");
    if (!MODE_TYPES.has(normalized)) {
      throw new AppError("mode_type ต้องเป็น off_days หรือ shifts", 400);
    }
    return normalized;
  }

  resolveDateRange(query = {}) {
    const month = query.month || dayjs().format("YYYY-MM");
    const monthDate = dayjs(`${month}-01`);

    if (!monthDate.isValid()) {
      throw new AppError("รูปแบบเดือนไม่ถูกต้อง", 400);
    }

    const startDate =
      query.start_date || monthDate.startOf("month").format("YYYY-MM-DD");
    const endDate =
      query.end_date || monthDate.endOf("month").format("YYYY-MM-DD");

    return { month, startDate, endDate };
  }

  isValidIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && dayjs(value).isValid();
  }

  isDateInMonth(date, month) {
    return this.isValidIsoDate(date) && dayjs(date).format("YYYY-MM") === month;
  }

  isPastDate(date) {
    return dayjs(date).isBefore(dayjs(), "day");
  }

  validateRosterPayload(rosterData) {
    if (
      !rosterData ||
      typeof rosterData !== "object" ||
      Array.isArray(rosterData)
    ) {
      throw new AppError("กรุณาระบุ roster_data ให้ถูกต้อง", 400);
    }
  }

  isRosterLocked(rosterRow, modeType = "shifts") {
    if (!rosterRow) return false;
    if (modeType === "off_days" && rosterRow.source_system === "leavehub") {
      return true;
    }
    return !MUTABLE_DAY_TYPES.has(rosterRow.day_type);
  }

  async getOverview(companyId, query = {}) {
    const modeType = this.resolveModeType(query.mode_type);
    const { month, startDate, endDate } = this.resolveDateRange(query);

    const filters = {
      search: query.search?.trim() || "",
      department_id: query.department_id ? Number(query.department_id) : null,
    };

    const [
      employees,
      departments,
      shifts,
      rosters,
      dayoffCustomDays,
      leavehubStatus,
    ] = await Promise.all([
      RosterManageV2Model.findEmployeesForMode(companyId, modeType, filters),
      RosterManageV2Model.findDepartments(companyId),
      RosterManageV2Model.findShifts(companyId),
      RosterManageV2Model.findRostersByDateRange(
        companyId,
        startDate,
        endDate,
        modeType,
      ),
      RosterManageV2Model.findDayoffCustomDaysByDateRange(
        companyId,
        startDate,
        endDate,
        modeType,
      ),
      RosterManageV2Model.findLeavehubIntegrationStatus(companyId),
    ]);

    const isLeavehubConnected = leavehubStatus?.status === "active";

    return {
      employees,
      departments,
      shifts,
      rosters,
      dayoff_custom_days: dayoffCustomDays,
      leavehub_context: {
        connection_status: isLeavehubConnected ? "connected" : "disconnected",
        day_source: isLeavehubConnected ? "leave_hub" : "time_now",
        sync_status: leavehubStatus?.sync_status || null,
        last_sync_at: leavehubStatus?.last_sync_at || null,
        events_by_employee: [],
        global_events: [],
      },
      meta: {
        month,
        start_date: startDate,
        end_date: endDate,
        mode_type: modeType,
      },
    };
  }

  async ensureEmployeeAllowed(companyId, employeeId, modeType, executor) {
    const employee = await RosterManageV2Model.findEmployeeByIdAndMode(
      companyId,
      Number(employeeId),
      modeType,
      executor,
    );

    if (!employee) {
      throw new AppError(
        `พนักงาน ID ${employeeId} ไม่อยู่ในรายการที่อนุญาตสำหรับโหมดนี้`,
        400,
      );
    }

    return employee;
  }

  async ensureShiftAllowed(companyId, shiftId, shiftCache, executor) {
    const numericShiftId = Number(shiftId);
    if (!Number.isInteger(numericShiftId) || numericShiftId <= 0) {
      throw new AppError(`shift_id ${shiftId} ไม่ถูกต้อง`, 400);
    }

    if (shiftCache.has(numericShiftId)) return;

    const shift = await RosterManageV2Model.findShiftById(
      companyId,
      numericShiftId,
      executor,
    );
    if (!shift) {
      throw new AppError(`ไม่พบกะการทำงาน ID ${numericShiftId}`, 400);
    }

    shiftCache.add(numericShiftId);
  }

  pushSkipped(skipped, employeeId, date, reason) {
    skipped.push({
      employee_id: Number(employeeId),
      work_date: date,
      reason,
    });
  }

  canSetOffDay(existingRoster) {
    return !this.isRosterLocked(existingRoster, "off_days");
  }

  isLocalWeeklyOff(existingRoster) {
    return (
      existingRoster?.source_system === "local" &&
      existingRoster?.day_type === "weekly_off"
    );
  }

  isLocalWorkday(existingRoster) {
    return (
      existingRoster?.source_system === "local" &&
      existingRoster?.day_type === "workday"
    );
  }

  async applyOffDaySet({
    companyId,
    user,
    employeeId,
    date,
    connection,
    counters,
    skipped,
    audits,
    existingRoster,
    existingCustomDay,
  }) {
    if (!this.canSetOffDay(existingRoster)) {
      const reason = this.isRosterLocked(existingRoster, "off_days")
        ? "locked_by_source_or_day_type"
        : "shift_already_assigned";
      this.pushSkipped(skipped, employeeId, date, reason);
      return;
    }

    await RosterManageV2Model.upsertDayoffCustomDay(
      companyId,
      employeeId,
      date,
      user.id,
      connection,
    );

    await RosterManageV2Model.upsertWeeklyOffRoster(
      companyId,
      employeeId,
      date,
      connection,
    );

    if (existingCustomDay) {
      counters.updated += 1;
    } else {
      counters.created += 1;
      audits.push({
        userId: user.id,
        companyId,
        action: "INSERT",
        table: "employee_dayoff_custom_days",
        recordId: 0,
        oldVal: null,
        newVal: {
          company_id: companyId,
          employee_id: Number(employeeId),
          off_date: date,
        },
      });
    }

    if (existingRoster) {
      counters.updated += 1;
      audits.push({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "rosters",
        recordId: existingRoster.id,
        oldVal: existingRoster,
        newVal: {
          ...existingRoster,
          shift_id: null,
          day_type: "weekly_off",
          source_system: "local",
        },
      });
      return;
    }

    counters.created += 1;
    audits.push({
      userId: user.id,
      companyId,
      action: "INSERT",
      table: "rosters",
      recordId: 0,
      oldVal: null,
      newVal: {
        company_id: companyId,
        employee_id: Number(employeeId),
        work_date: date,
        shift_id: null,
        day_type: "weekly_off",
        source_system: "local",
      },
    });
  }

  async applyOffDayUnset({
    companyId,
    user,
    employeeId,
    connection,
    counters,
    audits,
    existingRoster,
    existingCustomDay,
    skipped,
    date,
  }) {
    if (this.isRosterLocked(existingRoster, "off_days")) {
      this.pushSkipped(
        skipped,
        employeeId,
        date,
        "locked_by_source_or_day_type",
      );
      return;
    }

    if (existingCustomDay) {
      const customDayId = existingCustomDay?.id;
      const affected = await RosterManageV2Model.deleteDayoffCustomDayById(
        customDayId,
        companyId,
        connection,
      );
      if (affected > 0) {
        counters.deleted += 1;
        audits.push({
          userId: user.id,
          companyId,
          action: "DELETE",
          table: "employee_dayoff_custom_days",
          recordId: customDayId,
          oldVal: existingCustomDay,
          newVal: null,
        });
      }
    }

    if (!this.isLocalWeeklyOff(existingRoster)) {
      return;
    }

    const shiftCustomDay =
      await RosterManageV2Model.findShiftCustomDayByEmployeeAndDate(
        companyId,
        employeeId,
        date,
        connection,
      );

    const normalShiftAssignment = shiftCustomDay
      ? null
      : await RosterManageV2Model.findNormalShiftAssignmentByEmployeeAndDate(
          companyId,
          employeeId,
          date,
          connection,
        );

    const restoredShiftId =
      shiftCustomDay?.shift_id ?? normalShiftAssignment?.shift_id ?? null;

    await RosterManageV2Model.upsertWorkdayRoster(
      companyId,
      employeeId,
      date,
      restoredShiftId,
      connection,
    );

    counters.updated += 1;
    audits.push({
      userId: user.id,
      companyId,
      action: "UPDATE",
      table: "rosters",
      recordId: existingRoster.id,
      oldVal: existingRoster,
      newVal: {
        ...existingRoster,
        shift_id: restoredShiftId,
        day_type: "workday",
        source_system: "local",
      },
    });
  }

  async clearShiftIfPossible({
    companyId,
    user,
    employeeId,
    date,
    connection,
    counters,
    skipped,
    audits,
    existingRoster,
    existingShiftCustomDay,
  }) {
    if (this.isRosterLocked(existingRoster, "shifts")) {
      this.pushSkipped(
        skipped,
        employeeId,
        date,
        "locked_by_source_or_day_type",
      );
      return;
    }

    if (existingShiftCustomDay) {
      const affectedShiftCustomDay =
        await RosterManageV2Model.deleteShiftCustomDayByEmployeeAndDate(
          companyId,
          employeeId,
          date,
          connection,
        );

      if (affectedShiftCustomDay > 0) {
        counters.deleted += 1;
        audits.push({
          userId: user.id,
          companyId,
          action: "DELETE",
          table: "employee_shift_custom_days",
          recordId: existingShiftCustomDay.id,
          oldVal: existingShiftCustomDay,
          newVal: null,
        });
      }
    }

    if (!this.isLocalWorkday(existingRoster)) {
      return;
    }

    const rosterId = existingRoster?.id;
    const affected = await RosterManageV2Model.deleteRosterById(
      rosterId,
      companyId,
      connection,
    );

    if (affected <= 0) {
      return;
    }

    counters.deleted += 1;
    audits.push({
      userId: user.id,
      companyId,
      action: "DELETE",
      table: "rosters",
      recordId: rosterId,
      oldVal: existingRoster,
      newVal: null,
    });
  }

  async assignShiftIfPossible({
    companyId,
    user,
    employeeId,
    date,
    shiftId,
    connection,
    counters,
    skipped,
    shiftCache,
    audits,
    existingRoster,
    existingCustomDay,
    existingShiftCustomDay,
  }) {
    if (shiftId === null) {
      this.pushSkipped(skipped, employeeId, date, "invalid_shift_value");
      return;
    }

    if (existingCustomDay) {
      this.pushSkipped(skipped, employeeId, date, "dayoff_custom_day_exists");
      return;
    }

    if (this.isRosterLocked(existingRoster, "shifts")) {
      this.pushSkipped(
        skipped,
        employeeId,
        date,
        "locked_by_source_or_day_type",
      );
      return;
    }

    await this.ensureShiftAllowed(companyId, shiftId, shiftCache, connection);

    const numericShiftId = Number(shiftId);

    await RosterManageV2Model.upsertShiftCustomDay(
      companyId,
      employeeId,
      date,
      numericShiftId,
      user.id,
      connection,
    );

    if (existingShiftCustomDay) {
      counters.updated += 1;
      audits.push({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "employee_shift_custom_days",
        recordId: existingShiftCustomDay.id,
        oldVal: existingShiftCustomDay,
        newVal: {
          ...existingShiftCustomDay,
          shift_id: numericShiftId,
        },
      });
    } else {
      counters.created += 1;
      audits.push({
        userId: user.id,
        companyId,
        action: "INSERT",
        table: "employee_shift_custom_days",
        recordId: 0,
        oldVal: null,
        newVal: {
          company_id: companyId,
          employee_id: Number(employeeId),
          work_date: date,
          shift_id: numericShiftId,
        },
      });
    }

    await RosterManageV2Model.upsertWorkdayRoster(
      companyId,
      employeeId,
      date,
      numericShiftId,
      connection,
    );

    if (existingRoster) {
      counters.updated += 1;
      audits.push({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "rosters",
        recordId: existingRoster.id,
        oldVal: existingRoster,
        newVal: {
          ...existingRoster,
          shift_id: numericShiftId,
          day_type: "workday",
          source_system: "local",
        },
      });
      return;
    }

    counters.created += 1;
    audits.push({
      userId: user.id,
      companyId,
      action: "INSERT",
      table: "rosters",
      recordId: 0,
      oldVal: null,
      newVal: {
        company_id: companyId,
        employee_id: Number(employeeId),
        work_date: date,
        shift_id: numericShiftId,
        day_type: "workday",
        source_system: "local",
      },
    });
  }

  async processEmployeeDateMap({
    companyId,
    user,
    employeeId,
    dateMap,
    month,
    modeType,
    connection,
    counters,
    skipped,
    audits,
    shiftCache,
  }) {
    const dates = Object.keys(dateMap || {}).sort((a, b) => a.localeCompare(b));

    for (const date of dates) {
      if (!this.isDateEligibleForBulk(date, month)) continue;

      const value = dateMap[date];
      await this.processBulkCell({
        modeType,
        companyId,
        user,
        employeeId,
        date,
        value,
        connection,
        counters,
        skipped,
        audits,
        shiftCache,
      });
    }
  }

  isDateEligibleForBulk(date, month) {
    return (
      this.isValidIsoDate(date) &&
      this.isDateInMonth(date, month) &&
      !this.isPastDate(date)
    );
  }

  normalizeBulkCellValue(modeType, rawValue) {
    // Guard clause: ถ้าไม่ใช่ object ที่คาดหวัง ให้ return rawValue
    if (!this.isValidObject(rawValue)) {
      return rawValue;
    }

    // Handle โดย priority mapping
    return this.handleObjectValue(rawValue, modeType);
  }

  isValidObject(rawValue) {
    return (
      rawValue !== null &&
      typeof rawValue === "object" &&
      !Array.isArray(rawValue)
    );
  }

  handleObjectValue(rawValue, modeType) {
    const action = String(rawValue.action || "").toLowerCase();

    // Priority 1: action = delete
    if (action === "delete") {
      return modeType === "off_days" ? OFFDAY_DELETE_TOKEN : 0;
    }

    // Priority 2-4: ใช้ mapping table แทน if chain
    const handlers = {
      value: () => rawValue.value,
      shift_id: () => rawValue.shift_id,
      off_day: () => (rawValue.off_day ? null : OFFDAY_DELETE_TOKEN),
    };

    for (const [key, handler] of Object.entries(handlers)) {
      if (Object.hasOwn(rawValue, key)) {
        return handler();
      }
    }

    return null;
  }

  async processBulkCell({
    modeType,
    companyId,
    user,
    employeeId,
    date,
    value,
    connection,
    counters,
    skipped,
    audits,
    shiftCache,
  }) {
    const normalizedValue = this.normalizeBulkCellValue(modeType, value);

    if (modeType === "off_days") {
      await this.handleOffDayUpdate({
        companyId,
        user,
        employeeId,
        date,
        value: normalizedValue,
        connection,
        counters,
        skipped,
        audits,
      });
      return;
    }

    await this.handleShiftUpdate({
      companyId,
      user,
      employeeId,
      date,
      shiftId: normalizedValue,
      connection,
      counters,
      skipped,
      shiftCache,
      audits,
    });
  }

  async handleOffDayUpdate({
    companyId,
    user,
    employeeId,
    date,
    value,
    connection,
    counters,
    skipped,
    audits,
  }) {
    const existingRoster =
      await RosterManageV2Model.findRosterByEmployeeAndDate(
        companyId,
        employeeId,
        date,
        connection,
      );

    const existingCustomDay =
      await RosterManageV2Model.findDayoffCustomDayByEmployeeAndDate(
        companyId,
        employeeId,
        date,
        connection,
      );

    if (value === null) {
      await this.applyOffDaySet({
        companyId,
        user,
        employeeId,
        date,
        connection,
        counters,
        skipped,
        audits,
        existingRoster,
        existingCustomDay,
      });
      return;
    }

    if (value !== OFFDAY_DELETE_TOKEN && value !== undefined) {
      this.pushSkipped(skipped, employeeId, date, "invalid_offday_payload");
      return;
    }

    await this.applyOffDayUnset({
      companyId,
      user,
      employeeId,
      connection,
      counters,
      audits,
      existingRoster,
      existingCustomDay,
      skipped,
      date,
    });
  }

  async handleShiftUpdate({
    companyId,
    user,
    employeeId,
    date,
    shiftId,
    connection,
    counters,
    skipped,
    shiftCache,
    audits,
  }) {
    const existingRoster =
      await RosterManageV2Model.findRosterByEmployeeAndDate(
        companyId,
        employeeId,
        date,
        connection,
      );

    const existingCustomDay =
      await RosterManageV2Model.findDayoffCustomDayByEmployeeAndDate(
        companyId,
        employeeId,
        date,
        connection,
      );

    const existingShiftCustomDay =
      await RosterManageV2Model.findShiftCustomDayByEmployeeAndDate(
        companyId,
        employeeId,
        date,
        connection,
      );

    const isClearShift = shiftId === 0 || shiftId === "0" || shiftId === "";

    if (isClearShift) {
      await this.clearShiftIfPossible({
        companyId,
        user,
        employeeId,
        date,
        connection,
        counters,
        skipped,
        audits,
        existingRoster,
        existingShiftCustomDay,
      });
      return;
    }

    await this.assignShiftIfPossible({
      companyId,
      user,
      employeeId,
      date,
      shiftId,
      connection,
      counters,
      skipped,
      shiftCache,
      audits,
      existingRoster,
      existingCustomDay,
      existingShiftCustomDay,
    });
  }

  async bulkSave(companyId, user, payload, ipAddress) {
    const modeType = this.resolveModeType(payload.mode_type);
    const month = payload.month || dayjs().format("YYYY-MM");
    this.validateRosterPayload(payload.roster_data);

    const counters = { created: 0, updated: 0, deleted: 0 };
    const skipped = [];
    const audits = [];
    const shiftCache = new Set();

    const leavehubStatus =
      await RosterManageV2Model.findLeavehubIntegrationStatus(companyId);
    const isLeavehubConnected = leavehubStatus?.status === "active";

    if (modeType === "off_days" && isLeavehubConnected) {
      throw new AppError("โหมดกำหนดวันหยุดถูกล็อกเมื่อเชื่อมต่อ Leavehub", 409);
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const employeeIds = Object.keys(payload.roster_data || {});

      for (const employeeIdStr of employeeIds) {
        const employeeId = Number(employeeIdStr);
        if (!employeeId) continue;

        await this.ensureEmployeeAllowed(
          companyId,
          employeeId,
          modeType,
          connection,
        );

        const dateMap = payload.roster_data[employeeIdStr] || {};
        const rawDates = Object.keys(dateMap || {});
        rawDates.forEach((date) => {
          if (this.isValidIsoDate(date) && this.isPastDate(date)) {
            this.pushSkipped(skipped, employeeId, date, "past_date_read_only");
          }
        });

        await this.processEmployeeDateMap({
          companyId,
          user,
          employeeId,
          dateMap,
          month,
          modeType,
          connection,
          counters,
          skipped,
          audits,
          shiftCache,
        });
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    for (const audit of audits) {
      await auditRecord({ ...audit, ipAddress });
    }

    return {
      created: counters.created,
      updated: counters.updated,
      deleted: counters.deleted,
      total_changed: counters.created + counters.updated + counters.deleted,
      skipped,
      meta: {
        mode_type: modeType,
        month,
      },
    };
  }
}

module.exports = new RosterManageV2Service();
