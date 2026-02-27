const DashboardModel = require("./dashboard.model");

// Dashboard Service
class DashboardService {
  // ==============================================================
  // ดึงข้อมูลภาพรวม Dashboard ทั้งหมดในครั้งเดียว
  async getDashboardOverview(companyId) {
    // ดึงข้อมูลทั้งหมดแบบ parallel เพื่อประสิทธิภาพสูงสุด
    const [todayLogs, stats, pendingCount, pendingRequests] = await Promise.all(
      [
        DashboardModel.getTodayAttendanceLogs(companyId, 20),
        DashboardModel.getTodayStats(companyId),
        DashboardModel.getPendingRequestCount(companyId),
        DashboardModel.getPendingRequests(companyId, 20),
      ],
    );

    // จัดรูปแบบ pending requests ให้สอดคล้องกับที่ Frontend ต้องการ
    const formattedRequests = pendingRequests.map((req) => ({
      id: req.id,
      request_type: req.request_type,
      status: req.status,
      request_data:
        typeof req.request_data === "string"
          ? JSON.parse(req.request_data)
          : req.request_data,
      created_at: req.created_at,
      employee: {
        id: req.employee_id,
        name: req.employee_name,
        code: req.employee_code,
        avatar: req.employee_avatar,
      },
    }));

    return {
      today_logs: todayLogs,
      stats,
      pending_requests: {
        total: pendingCount,
        requests: formattedRequests,
      },
    };
  }
}

module.exports = new DashboardService();
