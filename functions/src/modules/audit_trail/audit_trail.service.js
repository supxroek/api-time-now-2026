const AuditTrailModel = require("./audit_trail.model");
const AppError = require("../../utils/AppError");

// Audit Trail Service
class AuditTrailService {
  // ==============================================================
  // ดึงรายการ Audit Logs
  async getAuditLogs(user, query) {
    const {
      page = 1,
      limit = 20,
      action_type,
      table_name,
      user_id,
      start_date,
      end_date,
      search,
    } = query;

    const offset = (page - 1) * limit;
    const filters = {
      action_type,
      table_name,
      user_id,
      start_date,
      end_date,
      search,
    };

    const logs = await AuditTrailModel.findAll(
      user.company_id,
      filters,
      limit,
      offset,
    );
    const total = await AuditTrailModel.countAll(user.company_id, filters);

    // stats
    const stats = await AuditTrailModel.getStats(user.company_id);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      total_pages: Math.ceil(total / limit),
      data: logs,
      stats,
    };
  }

  // ==============================================================
  // ดึงรายละเอียด Audit Log
  async getAuditLogById(user, id) {
    const log = await AuditTrailModel.findById(id, user.company_id);
    if (!log) {
      throw new AppError("ไม่พบข้อมูล Audit Log ที่ต้องการ", 404);
    }
    return log;
  }
}

module.exports = new AuditTrailService();
