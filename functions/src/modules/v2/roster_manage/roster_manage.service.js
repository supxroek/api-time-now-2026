const dayjs = require("dayjs");
const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const db = require("../../../config/db.config");
const RosterManageV2Model = require("./roster_manage.model");
const IntegrationV2Service = require("../integrations/integration.service");

class RosterManageV2Service {
  normalizeWorkspaceMode(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "holiday") return "holiday";
    if (normalized === "shift") return "shift";
    return "unified";
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
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  isReadOnlyBySystem(existingRoster) {
    const dayType = String(existingRoster?.day_type || "").toLowerCase();
    const isLeave = dayType.endsWith("_leave");
    const isHoliday = [
      "public_holiday",
      "compensated_holiday",
      "holiday_swap",
    ].includes(dayType);

    return existingRoster?.source_system === "leavehub" || isLeave || isHoliday;
  }

  isPastDate(workDate) {
    return dayjs(workDate).isBefore(dayjs().startOf("day"), "day");
  }

  isTodayDate(workDate) {
    return dayjs(workDate).isSame(dayjs(), "day");
  }

  normalizeCellAction(rawValue) {
    if (rawValue === undefined) {
      return { type: "NONE" };
    }

    if (rawValue === null) {
      return { type: "WEEKLY_OFF" };
    }

    if (typeof rawValue === "number") {
      if (rawValue === 0) return { type: "EMPTY" };
      return { type: "SHIFT", shiftId: rawValue };
    }

    if (typeof rawValue === "string") {
      if (rawValue === "") return { type: "EMPTY" };
      const parsed = Number(rawValue);
      if (!Number.isNaN(parsed)) {
        if (parsed === 0) return { type: "EMPTY" };
        return { type: "SHIFT", shiftId: parsed };
      }
      return { type: "NONE" };
    }

    if (typeof rawValue === "object") {
      const kind = String(rawValue.kind || rawValue.type || "").toUpperCase();
      if (kind === "EMPTY") return { type: "EMPTY" };
      if (kind === "WEEKLY_OFF") return { type: "WEEKLY_OFF" };
      if (kind === "SHIFT") {
        return { type: "SHIFT", shiftId: Number(rawValue.shift_id) };
      }
    }

    return { type: "NONE" };
  }

  async getOverview(companyId, query) {
    const { month, startDate, endDate } = this.resolveDateRange(query);
    const workspaceMode = this.normalizeWorkspaceMode(query?.mode || "unified");
    const filters = {
      search: query?.search || undefined,
      department_id: query?.department_id ? Number(query.department_id) : null,
    };

    const [
      employees,
      departments,
      shifts,
      rosters,
      attendanceFlags,
      leaveHubStatus,
      leavehubContext,
    ] = await Promise.all([
      RosterManageV2Model.findEmployeesForWorkspace(companyId, filters),
      RosterManageV2Model.findDepartments(companyId),
      RosterManageV2Model.findShifts(companyId),
      RosterManageV2Model.findRostersByDateRange(companyId, startDate, endDate),
      RosterManageV2Model.findAttendanceFlagsByDateRange(
        companyId,
        startDate,
        endDate,
      ),
      IntegrationV2Service.getLeaveHubStatus(companyId).catch(() => ({
        connected: false,
        integration: null,
      })),
      IntegrationV2Service.getLeaveHubRosterContext(companyId, {
        month,
        start_date: startDate,
        end_date: endDate,
      }).catch(() => ({
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
      })),
    ]);

    return {
      employees,
      departments,
      shifts,
      rosters,
      attendance_flags: attendanceFlags,
      leavehub_status: leaveHubStatus,
      leavehub_context: leavehubContext,
      meta: {
        month,
        start_date: startDate,
        end_date: endDate,
        workspace_mode: workspaceMode,
      },
    };
  }

  async bulkUpsert(companyId, user, payload, ipAddress, options = {}) {
    const workspaceMode = this.normalizeWorkspaceMode(
      options?.mode || "unified",
    );
    const rosterData = payload?.roster_data;
    if (!rosterData || typeof rosterData !== "object") {
      throw new AppError("กรุณาระบุ roster_data ให้ถูกต้อง", 400);
    }

    const employeeIds = Object.keys(rosterData)
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0);

    const employeeCache = new Map();
    const shiftCache = new Set();
    const summary = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped_readonly: 0,
      skipped_invalid: 0,
      skipped_past_locked: 0,
      warning_today_with_logs: 0,
      touched_employees: new Set(),
      affected_dates: new Set(),
    };

    const todayWithLogs = new Set();
    if (workspaceMode === "shift") {
      const today = dayjs().format("YYYY-MM-DD");
      const attendanceToday =
        await RosterManageV2Model.findAttendanceFlagsByDateRange(
          companyId,
          today,
          today,
          employeeIds,
        );

      attendanceToday.forEach((row) => {
        if (row?.first_check_in) {
          todayWithLogs.add(`${row.employee_id}|${today}`);
        }
      });
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      for (const employeeId of employeeIds) {
        const cacheKey = String(employeeId);
        if (!employeeCache.has(cacheKey)) {
          const employee =
            await RosterManageV2Model.findEmployeeByIdForWorkspace(
              companyId,
              employeeId,
            );

          if (!employee) {
            throw new AppError(
              `พนักงาน ID ${employeeId} ไม่อยู่ในรายการที่อนุญาตสำหรับ Unified Workspace`,
              400,
            );
          }

          employeeCache.set(cacheKey, employee);
        }

        const dateMap = rosterData[employeeId] || rosterData[cacheKey] || {};
        const dateEntries = Object.entries(dateMap);

        for (const [workDate, rawValue] of dateEntries) {
          if (!this.isValidIsoDate(workDate)) {
            summary.skipped_invalid += 1;
            continue;
          }

          if (this.isPastDate(workDate)) {
            summary.skipped_past_locked += 1;
            continue;
          }

          const action = this.normalizeCellAction(rawValue);
          if (action.type === "NONE") {
            continue;
          }

          if (workspaceMode === "holiday") {
            if (!["EMPTY", "WEEKLY_OFF"].includes(action.type)) {
              summary.skipped_invalid += 1;
              continue;
            }
          }

          if (workspaceMode === "shift") {
            if (!["EMPTY", "SHIFT"].includes(action.type)) {
              summary.skipped_invalid += 1;
              continue;
            }
          }

          const existing =
            await RosterManageV2Model.findRosterByEmployeeAndDate(
              companyId,
              employeeId,
              workDate,
              connection,
            );

          if (existing && this.isReadOnlyBySystem(existing)) {
            summary.skipped_readonly += 1;
            continue;
          }

          if (
            workspaceMode === "shift" &&
            this.isTodayDate(workDate) &&
            todayWithLogs.has(`${employeeId}|${workDate}`)
          ) {
            summary.warning_today_with_logs += 1;
          }

          if (action.type === "EMPTY") {
            if (!existing) {
              continue;
            }

            if (workspaceMode === "holiday") {
              // Holiday mode clears explicit weekly-off snapshot but preserves shift override.
              await RosterManageV2Model.upsertLocalRosterCell(
                companyId,
                employeeId,
                workDate,
                existing.shift_id || null,
                "workday",
                connection,
              );

              const fresh =
                await RosterManageV2Model.findRosterByEmployeeAndDate(
                  companyId,
                  employeeId,
                  workDate,
                  connection,
                );

              await auditRecord({
                userId: user.id,
                companyId,
                action: "UPDATE",
                table: "rosters",
                recordId: fresh?.id || existing.id,
                oldVal: existing,
                newVal: fresh || null,
                ipAddress,
              });

              summary.updated += 1;
              summary.touched_employees.add(employeeId);
              summary.affected_dates.add(workDate);
              continue;
            }

            await RosterManageV2Model.deleteRosterByEmployeeAndDate(
              companyId,
              employeeId,
              workDate,
              connection,
            );

            await auditRecord({
              userId: user.id,
              companyId,
              action: "DELETE",
              table: "rosters",
              recordId: existing.id,
              oldVal: existing,
              newVal: null,
              ipAddress,
            });

            summary.deleted += 1;
            summary.touched_employees.add(employeeId);
            summary.affected_dates.add(workDate);
            continue;
          }

          if (action.type === "SHIFT") {
            const shiftId = Number(action.shiftId);
            if (!Number.isInteger(shiftId) || shiftId <= 0) {
              summary.skipped_invalid += 1;
              continue;
            }

            if (!shiftCache.has(shiftId)) {
              const shift = await RosterManageV2Model.findShiftById(
                companyId,
                shiftId,
              );
              if (!shift) {
                throw new AppError(`ไม่พบกะงาน ID ${shiftId}`, 400);
              }
              shiftCache.add(shiftId);
            }

            await RosterManageV2Model.upsertLocalRosterCell(
              companyId,
              employeeId,
              workDate,
              shiftId,
              "workday",
              connection,
            );

            const fresh = await RosterManageV2Model.findRosterByEmployeeAndDate(
              companyId,
              employeeId,
              workDate,
              connection,
            );

            await auditRecord({
              userId: user.id,
              companyId,
              action: existing ? "UPDATE" : "INSERT",
              table: "rosters",
              recordId: fresh?.id || existing?.id || 0,
              oldVal: existing || null,
              newVal: fresh || null,
              ipAddress,
            });

            summary[existing ? "updated" : "created"] += 1;
            summary.touched_employees.add(employeeId);
            summary.affected_dates.add(workDate);
            continue;
          }

          if (action.type === "WEEKLY_OFF") {
            await RosterManageV2Model.upsertLocalRosterCell(
              companyId,
              employeeId,
              workDate,
              null,
              "weekly_off",
              connection,
            );

            const fresh = await RosterManageV2Model.findRosterByEmployeeAndDate(
              companyId,
              employeeId,
              workDate,
              connection,
            );

            await auditRecord({
              userId: user.id,
              companyId,
              action: existing ? "UPDATE" : "INSERT",
              table: "rosters",
              recordId: fresh?.id || existing?.id || 0,
              oldVal: existing || null,
              newVal: fresh || null,
              ipAddress,
            });

            summary[existing ? "updated" : "created"] += 1;
            summary.touched_employees.add(employeeId);
            summary.affected_dates.add(workDate);
          }
        }
      }

      await connection.commit();

      return {
        created: summary.created,
        updated: summary.updated,
        deleted: summary.deleted,
        skipped_readonly: summary.skipped_readonly,
        skipped_invalid: summary.skipped_invalid,
        skipped_past_locked: summary.skipped_past_locked,
        warning_today_with_logs: summary.warning_today_with_logs,
        total_changed: summary.created + summary.updated + summary.deleted,
        touched_employee_ids: Array.from(summary.touched_employees),
        affected_dates: Array.from(summary.affected_dates).sort((a, b) =>
          a.localeCompare(b),
        ),
        workspace_mode: workspaceMode,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async bulkSave(companyId, user, payload, ipAddress) {
    return this.bulkUpsert(companyId, user, payload, ipAddress);
  }

  async bulkUpsertDayType(companyId, user, payload, ipAddress) {
    return this.bulkUpsert(companyId, user, payload, ipAddress, {
      mode: "holiday",
    });
  }

  async bulkUpsertShift(companyId, user, payload, ipAddress) {
    return this.bulkUpsert(companyId, user, payload, ipAddress, {
      mode: "shift",
    });
  }
}

module.exports = new RosterManageV2Service();
