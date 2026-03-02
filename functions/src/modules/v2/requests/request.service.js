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

  static ALLOWED_REQUEST_TYPES = Object.keys(RequestService.REQUEST_TYPE_LABELS);

  static ALLOWED_STATUSES = Object.keys(RequestService.STATUS_LABELS);

  normalizePositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) return fallback;
    const integer = Math.floor(parsed);
    if (integer < min) return fallback;
    return Math.min(integer, max);
  }

  normalizeDate(value, fieldName) {
    if (!value) return undefined;
    const dateString = String(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      throw new AppError(`${fieldName} ต้องอยู่ในรูปแบบ YYYY-MM-DD`, 400);
    }
    return dateString;
  }

  normalizeRequestType(value) {
    if (!value) return undefined;
    if (!RequestService.ALLOWED_REQUEST_TYPES.includes(value)) {
      throw new AppError("request_type ไม่ถูกต้อง", 400);
    }
    return value;
  }

  normalizeStatusList(value) {
    if (!value) return [];

    const statusList = String(value)
      .split(",")
      .map((status) => status.trim())
      .filter(Boolean);

    if (statusList.length === 0) return [];

    const invalid = statusList.find(
      (status) => !RequestService.ALLOWED_STATUSES.includes(status),
    );

    if (invalid) {
      throw new AppError("status ไม่ถูกต้อง", 400);
    }

    return [...new Set(statusList)];
  }

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
    const requestData = this.normalizeRequestData(row.request_data);

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
      evidence_image: row.evidence_image || null,
      request_data: requestData,
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
      shift_swap: {
        from: row.from_shift_id
          ? {
              id: row.from_shift_id,
              name: row.from_shift_name,
              time: {
                start: row.from_shift_start_time,
                end: row.from_shift_end_time,
              },
            }
          : null,
        to: row.to_shift_id
          ? {
              id: row.to_shift_id,
              name: row.to_shift_name,
              time: {
                start: row.to_shift_start_time,
                end: row.to_shift_end_time,
              },
            }
          : null,
        shift_swap: {
          from_shift: row.from_shift_id || requestData?.from_shift || null,
          to_shift: row.to_shift_id || requestData?.to_shift || null,
        },
      },
    };
  }

  async getRequestList(companyId, query) {
    const page = this.normalizePositiveInt(query.page, 1, { min: 1, max: 100000 });
    const limit = this.normalizePositiveInt(query.limit, 50, { min: 1, max: 200 });
    const offset = (page - 1) * limit;

    const targetDateFrom = this.normalizeDate(
      query.target_date_from,
      "target_date_from",
    );
    const targetDateTo = this.normalizeDate(
      query.target_date_to,
      "target_date_to",
    );

    if (targetDateFrom && targetDateTo && targetDateFrom > targetDateTo) {
      throw new AppError(
        "target_date_from ต้องน้อยกว่าหรือเท่ากับ target_date_to",
        400,
      );
    }

    const filters = {
      employee_id: query.employee_id,
      status_list: this.normalizeStatusList(query.status),
      request_type: this.normalizeRequestType(query.request_type),
      target_date_from: targetDateFrom,
      target_date_to: targetDateTo,
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
        totalPages: Math.max(Math.ceil(total / limit), 1),
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
