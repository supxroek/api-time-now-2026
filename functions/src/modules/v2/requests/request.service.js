const AppError = require("../../../utils/AppError");
const RequestModel = require("./request.model");

class RequestService {
  static REQUEST_TYPE_LABELS = {
    correction: "แก้ไขเวลา",
    ot: "ขอ OT",
    shift_swap: "ขอสลับกะ",
  };

  static STATUS_LABELS = {
    pending: "รออนุมัติ",
    approved: "อนุมัติแล้ว",
    rejected: "ปฏิเสธ",
  };

  toEnumObject(key, labels) {
    if (!key) return null;
    return {
      key,
      label: labels[key] || key,
    };
  }

  normalizeRequestData(requestData) {
    if (requestData === null || requestData === undefined) {
      return null;
    }

    if (typeof requestData === "string") {
      try {
        return JSON.parse(requestData);
      } catch (error) {
        console.error("Failed to parse request_data:", error);
        return null;
      }
    }

    return requestData;
  }

  mapRequestRow(row) {
    return {
      id: row.id,
      company_id: row.company_id,
      request_type: this.toEnumObject(
        row.request_type,
        RequestService.REQUEST_TYPE_LABELS,
      ),
      status: this.toEnumObject(row.status, RequestService.STATUS_LABELS),
      target_date: row.target_date,
      roster_id: row.roster_id,
      ot_template_id: row.ot_template_id,
      created_at: row.created_at,
      approved_at: row.approved_at,
      rejected_reason: row.rejected_reason,
      evidence_image: row.evidence_image,
      request_data: this.normalizeRequestData(row.request_data),
      employee: {
        id: row.employee_id,
        code: row.employee_code,
        name: row.employee_name,
        avatar: row.employee_avatar,
      },
      approver: row.approver_id
        ? {
            id: row.approver_id,
            name: row.approver_name,
          }
        : null,
      ot_template: row.ot_template_id
        ? {
            id: row.ot_template_id,
            name: row.ot_template_name,
            start_time: row.ot_start_time,
            end_time: row.ot_end_time,
            duration_hours: row.ot_duration_hours,
            overtime_rate: row.ot_overtime_rate,
          }
        : null,
    };
  }

  async getRequestList(companyId, query) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 50);
    const offset = (page - 1) * limit;

    const filters = {
      employee_id: query.employee_id,
      status: query.status,
      request_type: query.request_type,
      target_date_from: query.target_date_from,
      target_date_to: query.target_date_to,
      search: query.search?.trim(),
    };

    const [rows, total] = await Promise.all([
      RequestModel.findAll(companyId, filters, limit, offset),
      RequestModel.countAll(companyId, filters),
    ]);

    return {
      requests: rows.map((row) => this.mapRequestRow(row)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRequestById(companyId, requestId) {
    const row = await RequestModel.findById(requestId, companyId);
    if (!row) {
      throw new AppError("ไม่พบข้อมูลคำขอ", 404);
    }

    return this.mapRequestRow(row);
  }

  async getRequestStats(companyId) {
    const stats = await RequestModel.getStats(companyId);
    return {
      total: Number(stats.total || 0),
      pending: Number(stats.pending || 0),
      approved: Number(stats.approved || 0),
      rejected: Number(stats.rejected || 0),
    };
  }
}

module.exports = new RequestService();
