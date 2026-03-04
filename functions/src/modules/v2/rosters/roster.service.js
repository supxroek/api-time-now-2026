const dayjs = require("dayjs");
const AppError = require("../../../utils/AppError");
const RosterV2Model = require("./roster.model");
const LeaveHubIntegrationService = require("../../v1/leaveHubIntegration/leaveHubIntegration.service");

class RosterV2Service {
  resolveRange(query = {}) {
    const month = query.month || dayjs().format("YYYY-MM");

    if (!/^\d{4}-\d{2}$/.test(String(month))) {
      throw new AppError("รูปแบบเดือนต้องเป็น YYYY-MM", 400);
    }

    const defaultStart = dayjs(`${month}-01`)
      .startOf("month")
      .format("YYYY-MM-DD");
    const defaultEnd = dayjs(`${month}-01`).endOf("month").format("YYYY-MM-DD");

    return {
      month,
      startDate: query.start_date || defaultStart,
      endDate: query.end_date || defaultEnd,
    };
  }

  async getOverview(companyId, query = {}) {
    const { month, startDate, endDate } = this.resolveRange(query);
    const employeeId = query.employee_id ? Number(query.employee_id) : null;
    const search = query.search?.trim() || "";

    const [employees, shifts, rosters, dayoffCustomDays, leavehubContext] =
      await Promise.all([
        RosterV2Model.findEmployeesForOverview(companyId, search),
        RosterV2Model.findShiftsForOverview(companyId),
        RosterV2Model.findRostersForOverview(
          companyId,
          startDate,
          endDate,
          employeeId,
        ),
        RosterV2Model.findDayoffCustomDaysForOverview(
          companyId,
          startDate,
          endDate,
          employeeId,
        ),
        LeaveHubIntegrationService.getRosterContext(
          { company_id: companyId },
          {
            month,
            start_date: startDate,
            end_date: endDate,
            employee_id: employeeId || undefined,
          },
        ).catch(() => ({
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
      shifts,
      rosters,
      dayoff_custom_days: dayoffCustomDays,
      leavehub_context: leavehubContext,
      meta: {
        month,
        start_date: startDate,
        end_date: endDate,
      },
    };
  }
}

module.exports = new RosterV2Service();
