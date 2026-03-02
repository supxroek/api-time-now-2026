const StatsService = require("../stats/stats.service");
const DashboardModel = require("./dashboard.model");

class DashboardService {
  normalizeLimit(value) {
    const parsed = Number(value || 10);
    if (!Number.isFinite(parsed)) return 10;
    if (parsed < 5) return 5;
    if (parsed > 10) return 10;
    return Math.floor(parsed);
  }

  mapRecentActivityRow(row) {
    return {
      id: row.id,
      company_id: row.company_id,
      employee_id: row.employee_id,
      device_id: row.device_id,
      log_type: row.log_type,
      log_timestamp: row.log_timestamp,
      is_manual: Boolean(row.is_manual),
      employee_name: row.employee_name,
      employee: {
        id: row.employee_id,
        name: row.employee_name,
        code: row.employee_code,
        avatar: row.employee_avatar,
      },
    };
  }

  mapPendingRequestRow(row) {
    return {
      id: row.id,
      company_id: row.company_id,
      employee_id: row.employee_id,
      request_type: row.request_type,
      status: row.status,
      target_date: row.target_date,
      created_at: row.created_at,
      request_data:
        typeof row.request_data === "string"
          ? JSON.parse(row.request_data)
          : row.request_data,
      employee: {
        id: row.employee_id,
        name: row.employee_name,
        code: row.employee_code,
        avatar: row.employee_avatar,
      },
    };
  }

  async getDashboardOverview(companyId, query = {}) {
    const todayLimit = this.normalizeLimit(
      query.today_limit || query.recent_limit,
    );
    const pendingLimit = this.normalizeLimit(query.pending_limit);

    const [stats, todayRows, pendingRows] = await Promise.all([
      StatsService.getOverview(companyId),
      DashboardModel.getTodayAttendanceLogs(companyId, todayLimit),
      DashboardModel.getPendingRequests(companyId, pendingLimit),
    ]);

    const todayLogs = todayRows.map((row) => this.mapRecentActivityRow(row));
    const pendingRequests = pendingRows.map((row) =>
      this.mapPendingRequestRow(row),
    );

    return {
      stats,
      today_logs: {
        total: todayLogs.length,
        limit: todayLimit,
        logs: todayLogs,
      },
      pending_requests: {
        limit: pendingLimit,
        requests: pendingRequests,
      },
    };
  }
}

module.exports = new DashboardService();
