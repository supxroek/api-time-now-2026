const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const StatsService = require("../stats/stats.service");
const OtTemplateModel = require("./ot_template.model");

class OtTemplateService {
  static ALLOWED_FIELDS = new Set([
    "name",
    "start_time",
    "end_time",
    "duration_minutes",
    "overtime_rate",
    "is_active",
  ]);

  // map ชื่อฟิลด์
  static FIELD_MAP = {
    name: "ชื่อ OT",
    start_time: "เวลาเริ่มต้น",
    end_time: "เวลาสิ้นสุด",
    duration_hours: "ชั่วโมงทำงานล่วงเวลา",
    duration_minutes: "นาทีทำงานล่วงเวลา",
    overtime_rate: "อัตราค่าตอบแทนล่วงเวลา",
    is_active: "สถานะใช้งาน",
  };

  filterAllowedFields(payload) {
    const filtered = {};
    Object.keys(payload || {}).forEach((key) => {
      if (OtTemplateService.ALLOWED_FIELDS.has(key)) {
        filtered[key] = payload[key];
      }
    });

    return filtered;
  }

  normalizeData(data) {
    const normalized = { ...data };

    if (normalized.name !== undefined) {
      normalized.name = normalized.name?.trim();
    }
    if (
      normalized.duration_minutes !== undefined &&
      normalized.duration_minutes !== null
    ) {
      normalized.duration_minutes = Number(normalized.duration_minutes);
    }
    if (
      normalized.overtime_rate !== undefined &&
      normalized.overtime_rate !== null
    ) {
      normalized.overtime_rate = Number(normalized.overtime_rate);
    }
    if (normalized.is_active !== undefined) {
      normalized.is_active = Number(normalized.is_active);
    }

    return normalized;
  }

  validateData(
    data,
    { requiredFields = ["name", "start_time", "end_time"] } = {},
  ) {
    if (requiredFields) {
      requiredFields.forEach((field) => {
        if (data[field] === undefined || data[field] === null) {
          throw new AppError(
            `กรุณาระบุ ${OtTemplateService.FIELD_MAP[field] || field}`,
            400,
          );
        }
      });
    }

    if (
      data.duration_minutes !== undefined &&
      data.duration_minutes !== null &&
      Number.isNaN(data.duration_minutes)
    ) {
      throw new AppError("duration_minutes ไม่ถูกต้อง", 400);
    }

    if (
      data.overtime_rate !== undefined &&
      data.overtime_rate !== null &&
      Number.isNaN(data.overtime_rate)
    ) {
      throw new AppError("overtime_rate ไม่ถูกต้อง", 400);
    }

    if (data.is_active !== undefined && ![0, 1].includes(data.is_active)) {
      throw new AppError("is_active ต้องเป็น 0 หรือ 1", 400);
    }
  }

  async createTemplate(user, payload, ipAddress) {
    const companyId = user.company_id;
    const cleanData = this.normalizeData(this.filterAllowedFields(payload));

    this.validateData(cleanData, {
      requiredFields: ["name", "start_time", "end_time"],
    });

    const duplicate = await OtTemplateModel.findByNameAndCompanyId(
      cleanData.name,
      companyId,
    );
    if (duplicate) {
      throw new AppError("มีชื่อรูปแบบ OT นี้ในระบบแล้ว", 400);
    }

    const dataToCreate = {
      company_id: companyId,
      name: cleanData.name,
      start_time: cleanData.start_time ?? null,
      end_time: cleanData.end_time ?? null,
      duration_minutes: cleanData.duration_minutes ?? 0,
      overtime_rate: cleanData.overtime_rate ?? 0,
      is_active: cleanData.is_active ?? 1,
    };

    const newId = await OtTemplateModel.create(dataToCreate);
    const created = await OtTemplateModel.findByIdAndCompanyId(
      newId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "INSERT",
        table: "ot_templates",
        recordId: newId,
        oldVal: null,
        newVal: created,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 ot_templates create):", error);
    }

    return created;
  }

  async getAllTemplates(companyId, query) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;
    const search = query.search?.trim() || "";

    const templates = await OtTemplateModel.findAllByCompanyId(
      companyId,
      search,
      limit,
      offset,
    );
    const total = await OtTemplateModel.countAllByCompanyId(companyId, search);

    return {
      templates,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOverview(companyId) {
    const [statsOverview, rows] = await Promise.all([
      StatsService.getOverview(companyId),
      OtTemplateModel.findOverviewByCompanyId(companyId),
    ]);

    const templates = (rows || []).map((row) => ({
      id: row.id,
      company_id: row.company_id,
      name: row.name,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_minutes: row.duration_minutes,
      overtime_rate: row.overtime_rate,
      is_active: Number(row.is_active || 0) === 1,
      deleted_at: row.deleted_at,
    }));

    return {
      contract_version: "v2.ot-templates.overview.2026-03-11",
      templates,
      stats: statsOverview?.ot || {},
      generated_at: new Date().toISOString(),
    };
  }

  async getTemplateById(companyId, templateId) {
    const template = await OtTemplateModel.findByIdAndCompanyId(
      templateId,
      companyId,
    );
    if (!template) {
      throw new AppError("ไม่พบข้อมูลรูปแบบ OT", 404);
    }

    return template;
  }

  async updateTemplate(user, templateId, payload, ipAddress) {
    const companyId = user.company_id;
    const oldTemplate = await OtTemplateModel.findByIdAndCompanyId(
      templateId,
      companyId,
    );
    if (!oldTemplate) {
      throw new AppError("ไม่พบข้อมูลรูปแบบ OT", 404);
    }

    const cleanData = this.normalizeData(this.filterAllowedFields(payload));
    this.validateData(cleanData, { requiredFields: [] });

    if (cleanData.name && cleanData.name !== oldTemplate.name) {
      const duplicate = await OtTemplateModel.findByNameAndCompanyId(
        cleanData.name,
        companyId,
        Number(templateId),
      );
      if (duplicate) {
        throw new AppError("มีชื่อรูปแบบ OT นี้ในระบบแล้ว", 400);
      }
    }

    await OtTemplateModel.updateByIdAndCompanyId(
      templateId,
      companyId,
      cleanData,
    );
    const updated = await OtTemplateModel.findByIdAndCompanyId(
      templateId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "ot_templates",
        recordId: Number(templateId),
        oldVal: oldTemplate,
        newVal: updated,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 ot_templates update):", error);
    }

    return updated;
  }

  async deleteTemplate(user, templateId, ipAddress) {
    const companyId = user.company_id;
    const oldTemplate = await OtTemplateModel.findByIdAndCompanyId(
      templateId,
      companyId,
    );
    if (!oldTemplate) {
      throw new AppError("ไม่พบข้อมูลรูปแบบ OT", 404);
    }

    await OtTemplateModel.softDeleteByIdAndCompanyId(templateId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "DELETE",
        table: "ot_templates",
        recordId: Number(templateId),
        oldVal: oldTemplate,
        newVal: { ...oldTemplate, deleted_at: new Date(), is_active: 0 },
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 ot_templates delete):", error);
    }
  }

  async restoreTemplate(user, templateId, ipAddress) {
    const companyId = user.company_id;
    const oldTemplate = await OtTemplateModel.findDeletedByIdAndCompanyId(
      templateId,
      companyId,
    );
    if (!oldTemplate) {
      throw new AppError("ไม่พบข้อมูลรูปแบบ OT ที่ถูกลบ", 404);
    }

    await OtTemplateModel.restoreByIdAndCompanyId(templateId, companyId);
    const restored = await OtTemplateModel.findByIdAndCompanyId(
      templateId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "ot_templates",
        recordId: Number(templateId),
        oldVal: oldTemplate,
        newVal: restored,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 ot_templates restore):", error);
    }

    return restored;
  }
}

module.exports = new OtTemplateService();
