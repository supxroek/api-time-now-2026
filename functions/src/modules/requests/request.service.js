const RequestModel = require("./request.model");

// Request Service
class RequestService {
  // ==============================================================
  // ดึงประวัติคำขอทั้งหมด
  async getRequestHistory(companyId, query) {
    const {
      page = 1,
      limit = 50,
      employee_id,
      status,
      request_type,
      start_date,
      end_date,
    } = query;
    const offset = (page - 1) * limit;

    const filters = { employee_id, status, request_type, start_date, end_date };

    const requests = await RequestModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await RequestModel.countAll(companyId, filters);

    return {
      requests,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = new RequestService();
