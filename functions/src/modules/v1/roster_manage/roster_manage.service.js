const dayjs = require("dayjs");
const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const RosterManageModel = require("./roster_manage.model");

class RosterManageService {
  isValidIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && dayjs(value).isValid();
  }

  isDateInMonth(date, month) {
    return this.isValidIsoDate(date) && dayjs(date).format("YYYY-MM") === month;
  }

  resolveDateRange(query) {
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

  resolveModeType(modeType = "off_days") {
    const value = modeType;
    if (!["off_days", "shifts"].includes(value)) {
      throw new AppError("mode_type ต้องเป็น off_days หรือ shifts", 400);
    }
    return value;
  }

  validateRosterPayload(rosterData) {
    if (!rosterData || typeof rosterData !== "object") {
      throw new AppError("กรุณาระบุ roster_data ให้ถูกต้อง", 400);
    }
  }

  parseWeeklyHolidaysConfig(weeklyHolidays) {
    if (!weeklyHolidays) {
      return {
        dateSet: new Set(),
        weekdaySet: new Set(),
      };
    }

    let parsed = weeklyHolidays;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return {
          dateSet: new Set(),
          weekdaySet: new Set(),
        };
      }
    }

    if (!Array.isArray(parsed)) {
      return {
        dateSet: new Set(),
        weekdaySet: new Set(),
      };
    }

    const dateSet = new Set();
    const weekdaySet = new Set();

    parsed.forEach((value) => {
      if (typeof value === "string") {
        if (this.isValidIsoDate(value)) {
          dateSet.add(value);
          return;
        }

        const numericWeekday = Number(value);
        if (
          Number.isInteger(numericWeekday) &&
          numericWeekday >= 0 &&
          numericWeekday <= 6
        ) {
          weekdaySet.add(numericWeekday);
        }
        return;
      }

      if (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 6
      ) {
        weekdaySet.add(value);
      }
    });

    return {
      dateSet,
      weekdaySet,
    };
  }

  parseWeeklyHolidaysToDateArray(weeklyHolidays) {
    const { dateSet } = this.parseWeeklyHolidaysConfig(weeklyHolidays);
    return Array.from(dateSet);
  }

  buildOffDateSetForRange(weeklyHolidays, startDate, endDate) {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const { dateSet, weekdaySet } =
      this.parseWeeklyHolidaysConfig(weeklyHolidays);
    const result = new Set();

    dateSet.forEach((date) => {
      const target = dayjs(date);
      if (!target.isValid() || target.isBefore(start) || target.isAfter(end)) {
        return;
      }

      result.add(target.format("YYYY-MM-DD"));
    });

    if (weekdaySet.size > 0) {
      let cursor = start;
      while (!cursor.isAfter(end)) {
        if (weekdaySet.has(cursor.day())) {
          result.add(cursor.format("YYYY-MM-DD"));
        }
        cursor = cursor.add(1, "day");
      }
    }

    return result;
  }

  buildOffDayRostersFromEmployees(employees, startDate, endDate) {
    const rows = [];

    employees.forEach((employee) => {
      const offDates = this.buildOffDateSetForRange(
        employee.weekly_holidays,
        startDate,
        endDate,
      );
      offDates.forEach((date) => {
        rows.push({
          id: null,
          employee_id: employee.id,
          shift_id: null,
          work_date: date,
        });
      });
    });

    rows.sort((a, b) => {
      if (a.work_date === b.work_date) {
        return a.employee_id - b.employee_id;
      }
      return a.work_date > b.work_date ? 1 : -1;
    });

    return rows;
  }

  mergeRosterAndOffRows(rosterRows, offRows) {
    const statusMap = new Map();

    rosterRows.forEach((row) => {
      const key = `${row.employee_id}|${dayjs(row.work_date).format("YYYY-MM-DD")}`;
      statusMap.set(key, {
        ...row,
        work_date: dayjs(row.work_date).format("YYYY-MM-DD"),
      });
    });

    offRows.forEach((row) => {
      const key = `${row.employee_id}|${dayjs(row.work_date).format("YYYY-MM-DD")}`;
      statusMap.set(key, {
        id: row.id ?? null,
        employee_id: row.employee_id,
        shift_id: null,
        work_date: dayjs(row.work_date).format("YYYY-MM-DD"),
      });
    });

    return Array.from(statusMap.values()).sort((a, b) => {
      if (a.work_date === b.work_date) {
        return a.employee_id - b.employee_id;
      }
      return a.work_date > b.work_date ? 1 : -1;
    });
  }

  async ensureEmployeeAllowed(companyId, employeeId, modeType) {
    const employee = await RosterManageModel.findEmployeeByIdAndMode(
      companyId,
      employeeId,
      modeType,
    );

    if (!employee) {
      throw new AppError(
        `พนักงาน ID ${employeeId} ไม่อยู่ในรายการที่อนุญาตสำหรับโหมดนี้`,
        400,
      );
    }
  }

  async ensureShiftAllowed(companyId, shiftId, shiftCache) {
    if (shiftCache.has(shiftId)) return;

    const shift = await RosterManageModel.findShiftById(companyId, shiftId);
    if (!shift) {
      throw new AppError(`ไม่พบกะการทำงาน ID ${shiftId}`, 400);
    }
    shiftCache.add(shiftId);
  }

  async recordRosterAudit({
    user,
    companyId,
    action,
    recordId,
    oldVal,
    newVal,
    ipAddress,
  }) {
    await auditRecord({
      userId: user.id,
      companyId,
      action,
      table: "rosters",
      recordId,
      oldVal,
      newVal,
      ipAddress,
    });
  }

  async processOffDayEntry({
    companyId,
    user,
    employeeId,
    workDate,
    oldRoster,
    ipAddress,
  }) {
    if (!oldRoster) {
      return { created: 0, updated: 0, deleted: 0 };
    }

    await RosterManageModel.deleteRosterByEmployeeAndDate(
      companyId,
      employeeId,
      workDate,
    );

    await this.recordRosterAudit({
      user,
      companyId,
      action: "DELETE",
      recordId: oldRoster.id,
      oldVal: oldRoster,
      newVal: null,
      ipAddress,
    });

    return { created: 0, updated: 0, deleted: 1 };
  }

  async processShiftEntry({
    companyId,
    user,
    employeeId,
    workDate,
    shiftId,
    oldRoster,
    shiftCache,
    ipAddress,
  }) {
    if (shiftId === undefined || shiftId === "") {
      return { created: 0, updated: 0, deleted: 0 };
    }

    const numericShiftId = Number(shiftId);
    if (!numericShiftId) {
      throw new AppError(`shift_id ของวันที่ ${workDate} ไม่ถูกต้อง`, 400);
    }

    await this.ensureShiftAllowed(companyId, numericShiftId, shiftCache);
    await RosterManageModel.upsertRoster(employeeId, numericShiftId, workDate);

    const newRoster = await RosterManageModel.findRosterByEmployeeAndDate(
      companyId,
      employeeId,
      workDate,
    );

    const newVal = {
      employee_id: employeeId,
      shift_id: numericShiftId,
      work_date: workDate,
      is_ot_allowed: 0,
      is_public_holiday: 0,
      leave_status: "none",
    };

    if (oldRoster) {
      await this.recordRosterAudit({
        user,
        companyId,
        action: "UPDATE",
        recordId: oldRoster.id,
        oldVal: oldRoster,
        newVal,
        ipAddress,
      });
      return { created: 0, updated: 1, deleted: 0 };
    }

    await this.recordRosterAudit({
      user,
      companyId,
      action: "INSERT",
      recordId: newRoster?.id || 0,
      oldVal: null,
      newVal,
      ipAddress,
    });
    return { created: 1, updated: 0, deleted: 0 };
  }

  sumCounters(target, delta) {
    target.created += delta.created;
    target.updated += delta.updated;
    target.deleted += delta.deleted;
  }

  async syncEmployeeWeeklyHolidays({
    companyId,
    user,
    employeeId,
    oldOffDates,
    offDateSet,
    ipAddress,
  }) {
    const newOffDates = Array.from(offDateSet).sort((a, b) =>
      a.localeCompare(b),
    );

    const isChanged =
      JSON.stringify(oldOffDates) !== JSON.stringify(newOffDates);

    if (!isChanged) {
      return { created: 0, updated: 0, deleted: 0 };
    }

    await RosterManageModel.updateEmployeeWeeklyHolidays(
      companyId,
      employeeId,
      newOffDates,
    );

    await auditRecord({
      userId: user.id,
      companyId,
      action: "UPDATE",
      table: "employees",
      recordId: employeeId,
      oldVal: { weekly_holidays: oldOffDates },
      newVal: { weekly_holidays: newOffDates },
      ipAddress,
    });

    return { created: 0, updated: 1, deleted: 0 };
  }

  async applyOffDayValue({
    companyId,
    user,
    employeeId,
    date,
    value,
    offDateSet,
    counters,
    ipAddress,
  }) {
    if (!this.isValidIsoDate(date)) return;

    const oldRoster = await RosterManageModel.findRosterByEmployeeAndDate(
      companyId,
      employeeId,
      date,
    );

    if (value === null) {
      if (oldRoster) {
        throw new AppError(
          `วันที่ ${date} มีตารางเวรกำหนดอยู่แล้ว ไม่สามารถกำหนดวันหยุดทับได้`,
          400,
        );
      }
      offDateSet.add(date);
      return;
    }

    offDateSet.delete(date);
  }

  async applyShiftValue({
    companyId,
    user,
    employeeId,
    date,
    shiftId,
    offDateSet,
    offWeekdaySet,
    counters,
    shiftCache,
    ipAddress,
  }) {
    if (!this.isValidIsoDate(date)) return;

    const oldRoster = await RosterManageModel.findRosterByEmployeeAndDate(
      companyId,
      employeeId,
      date,
    );

    const isEmptyShiftSelection =
      shiftId === 0 || shiftId === "0" || shiftId === "";

    if (isEmptyShiftSelection) {
      if (!oldRoster) {
        return;
      }

      await RosterManageModel.deleteRosterByEmployeeAndDate(
        companyId,
        employeeId,
        date,
      );

      await this.recordRosterAudit({
        user,
        companyId,
        action: "DELETE",
        recordId: oldRoster.id,
        oldVal: oldRoster,
        newVal: null,
        ipAddress,
      });

      counters.deleted += 1;
      return;
    }

    if (shiftId === null) {
      if (oldRoster) {
        throw new AppError(
          `วันที่ ${date} มีตารางเวรกำหนดอยู่แล้ว ไม่สามารถเปลี่ยนเป็นวันหยุดในแท็บจัดเวรได้`,
          400,
        );
      }
      return;
    }

    const weekday = dayjs(date).day();
    if (offDateSet.has(date) || offWeekdaySet?.has(weekday)) {
      throw new AppError(
        `วันที่ ${date} ถูกกำหนดเป็นวันหยุดอยู่แล้ว ไม่สามารถกำหนดเวรทับได้`,
        400,
      );
    }

    const delta = await this.processShiftEntry({
      companyId,
      user,
      employeeId,
      workDate: date,
      shiftId,
      oldRoster,
      shiftCache,
      ipAddress,
    });
    this.sumCounters(counters, delta);
  }

  async bulkSaveOffDays(
    companyId,
    user,
    rosterData,
    modeType,
    ipAddress,
    month,
  ) {
    const employeeIds = Object.keys(rosterData);
    const counters = { created: 0, updated: 0, deleted: 0 };
    const targetMonth = month || dayjs().format("YYYY-MM");

    for (const employeeIdStr of employeeIds) {
      const employeeId = Number(employeeIdStr);
      if (!employeeId) continue;

      const employee = await RosterManageModel.findEmployeeByIdAndMode(
        companyId,
        employeeId,
        modeType,
      );

      if (!employee) {
        throw new AppError(
          `พนักงาน ID ${employeeId} ไม่อยู่ในรายการที่อนุญาตสำหรับโหมดนี้`,
          400,
        );
      }

      const dateMap = rosterData[employeeIdStr] || {};
      const desiredMonthOffDates = new Set(
        Object.entries(dateMap)
          .filter(
            ([date, value]) =>
              value === null && this.isDateInMonth(date, targetMonth),
          )
          .map(([date]) => date),
      );

      const oldOffDates = this.parseWeeklyHolidaysToDateArray(
        employee.weekly_holidays,
      ).sort((a, b) => a.localeCompare(b));
      const offDateSet = new Set(oldOffDates);

      for (const [date, value] of Object.entries(dateMap)) {
        await this.applyOffDayValue({
          companyId,
          user,
          employeeId,
          date,
          value,
          offDateSet,
          counters,
          ipAddress,
        });
      }

      oldOffDates
        .filter((date) => this.isDateInMonth(date, targetMonth))
        .forEach((date) => {
          if (!desiredMonthOffDates.has(date)) {
            offDateSet.delete(date);
          }
        });

      const weeklyDelta = await this.syncEmployeeWeeklyHolidays({
        companyId,
        user,
        employeeId,
        oldOffDates,
        offDateSet,
        ipAddress,
      });
      this.sumCounters(counters, weeklyDelta);
    }

    return {
      created: counters.created,
      updated: counters.updated,
      deleted: counters.deleted,
      total_changed: counters.created + counters.updated + counters.deleted,
    };
  }

  async bulkSaveShifts(companyId, user, rosterData, modeType, ipAddress) {
    const employeeIds = Object.keys(rosterData);
    const shiftCache = new Set();
    const counters = { created: 0, updated: 0, deleted: 0 };

    for (const employeeIdStr of employeeIds) {
      const employeeId = Number(employeeIdStr);
      if (!employeeId) continue;
      await this.ensureEmployeeAllowed(companyId, employeeId, modeType);

      const dateMap = rosterData[employeeIdStr] || {};
      const employee = await RosterManageModel.findEmployeeByIdAndMode(
        companyId,
        employeeId,
        modeType,
      );
      const weeklyConfig = this.parseWeeklyHolidaysConfig(
        employee?.weekly_holidays,
      );
      const oldOffDates = Array.from(weeklyConfig.dateSet).sort((a, b) =>
        a.localeCompare(b),
      );
      const offDateSet = new Set(oldOffDates);
      const offWeekdaySet = weeklyConfig.weekdaySet;

      for (const [date, shiftId] of Object.entries(dateMap)) {
        await this.applyShiftValue({
          companyId,
          user,
          employeeId,
          date,
          shiftId,
          offDateSet,
          offWeekdaySet,
          counters,
          shiftCache,
          ipAddress,
        });
      }

      const weeklyDelta = await this.syncEmployeeWeeklyHolidays({
        companyId,
        user,
        employeeId,
        oldOffDates,
        offDateSet,
        ipAddress,
      });
      this.sumCounters(counters, weeklyDelta);
    }

    return {
      created: counters.created,
      updated: counters.updated,
      deleted: counters.deleted,
      total_changed: counters.created + counters.updated + counters.deleted,
    };
  }

  async getOverview(companyId, query) {
    const modeType = this.resolveModeType(query.mode_type);
    const { month, startDate, endDate } = this.resolveDateRange(query);

    const filters = {
      search: query.search,
      department_id: query.department_id
        ? Number(query.department_id)
        : undefined,
    };

    const [employees, departments, shifts, rosterRows] = await Promise.all([
      RosterManageModel.findEmployeesForMode(companyId, modeType, filters),
      RosterManageModel.findDepartments(companyId),
      RosterManageModel.findShifts(companyId),
      RosterManageModel.findRostersByDateRange(
        companyId,
        startDate,
        endDate,
        modeType,
      ),
    ]);

    const offRows = this.buildOffDayRostersFromEmployees(
      employees,
      startDate,
      endDate,
    );
    const rosters = this.mergeRosterAndOffRows(rosterRows, offRows);

    return {
      employees,
      departments,
      shifts,
      rosters,
      meta: {
        month,
        start_date: startDate,
        end_date: endDate,
        mode_type: modeType,
      },
    };
  }

  async bulkSave(companyId, user, payload, ipAddress) {
    const modeType = this.resolveModeType(payload.mode_type);
    const rosterData = payload.roster_data;
    this.validateRosterPayload(rosterData);

    if (modeType === "off_days") {
      return this.bulkSaveOffDays(
        companyId,
        user,
        rosterData,
        modeType,
        ipAddress,
        payload.month,
      );
    }

    return this.bulkSaveShifts(
      companyId,
      user,
      rosterData,
      modeType,
      ipAddress,
    );
  }
}

module.exports = new RosterManageService();
