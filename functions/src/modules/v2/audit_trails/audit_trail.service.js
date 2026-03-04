const AppError = require("../../../utils/AppError");
const AuditTrailModel = require("./audit_trail.model");

class AuditTrailService {
  static ACTION_TYPE_LABELS = {
    INSERT: "เพิ่มข้อมูล",
    UPDATE: "แก้ไขข้อมูล",
    DELETE: "ลบข้อมูล",
  };

  static USER_ROLE_LABELS = {
    super_admin: "ผู้ดูแลระบบสูงสุด",
    admin: "ผู้ดูแลระบบ",
    manager: "ผู้จัดการ",
  };

  toEnumObject(key, labels) {
    if (!key) return null;
    return {
      key,
      label: labels[key] || key,
    };
  }

  parseJsonField(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string") {
      return JSON.parse(value);
    }

    return value;
  }

  mapAuditTrailRow(row) {
    return {
      id: row.id,
      company_id: row.company_id,
      action_type: this.toEnumObject(
        row.action_type,
        AuditTrailService.ACTION_TYPE_LABELS,
      ),
      table_name: row.table_name,
      record_id: row.record_id,
      old_values: this.parseJsonField(row.old_values),
      new_values: this.parseJsonField(row.new_values),
      ip_address: row.ip_address,
      created_at: row.created_at,
      actor: {
        user_id: row.user_id,
        email: row.user_email,
        role: this.toEnumObject(
          row.user_role,
          AuditTrailService.USER_ROLE_LABELS,
        ),
        employee_id: row.user_employee_id,
        employee_name: row.user_name,
      },
    };
  }

  async getAuditTrailList(companyId, query) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200);
    const offset = (page - 1) * limit;

    const filters = {
      action_type: query.action_type,
      table_name: query.table_name,
      user_id: query.user_id,
      start_date: query.start_date,
      end_date: query.end_date,
      search: query.search?.trim(),
    };

    const [rows, total, stats] = await Promise.all([
      AuditTrailModel.findAll(companyId, filters, limit, offset),
      AuditTrailModel.countAll(companyId, filters),
      AuditTrailModel.getStats(companyId),
    ]);

    return {
      audit_trails: rows.map((row) => this.mapAuditTrailRow(row)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
      stats: {
        total: Number(stats.total || 0),
        inserts: Number(stats.inserts || 0),
        updates: Number(stats.updates || 0),
        deletes: Number(stats.deletes || 0),
      },
    };
  }

  async getAuditTrailById(companyId, auditTrailId) {
    const row = await AuditTrailModel.findById(auditTrailId, companyId);
    if (!row) {
      throw new AppError("ไม่พบข้อมูล Audit Trail", 404);
    }

    return this.mapAuditTrailRow(row);
  }

  async getAuditTrailStats(companyId) {
    const stats = await AuditTrailModel.getStats(companyId);
    return {
      total: Number(stats.total || 0),
      inserts: Number(stats.inserts || 0),
      updates: Number(stats.updates || 0),
      deletes: Number(stats.deletes || 0),
    };
  }
}

module.exports = new AuditTrailService();
