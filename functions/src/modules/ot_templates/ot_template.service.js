const OtTemplateModel = require("./ot_template.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// OT Template Service
class OtTemplateService {
  // ==============================================================
  // สร้างแม่แบบการทำงานล่วงเวลาใหม่
  async createOtTemplate(user, data, ipAddress) {
    const companyId = user.company_id;
    const { company_id, ...cleanData } = data;

    // ตรวจสอบชื่อรูปแบบ OT
    if (!cleanData.name) {
      throw new AppError("กรุณาระบุชื่อรูปแบบ OT", 400);
    }

    // ตรวจสอบชื่อรูปแบบ OT ซ้ำ
    const existing = await OtTemplateModel.findByName(
      cleanData.name,
      companyId,
    );
    if (existing) {
      throw new AppError("มีชื่อรูปแบบ OT นี้ในระบบแล้ว", 400);
    }

    const payload = {
      ...cleanData,
      company_id: companyId,
      is_active: 1,
    };

    const newId = await OtTemplateModel.create(payload);

    // Audit
    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "INSERT",
        table: "ot_templates",
        recordId: newId,
        oldVal: null,
        newVal: payload,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return { id: newId, ...payload };
  }

  // ==============================================================
  // ดึงแม่แบบการทำงานล่วงเวลาทั้งหมด
  async getAllOtTemplates(companyId, query) {
    const { page = 1, limit = 20, search } = query;
    const offset = (page - 1) * limit;

    const filters = { search };

    const templates = await OtTemplateModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await OtTemplateModel.countAll(companyId, filters);

    return {
      templates,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // ดึงแม่แบบการทำงานล่วงเวลาโดย ID
  async getOtTemplateById(companyId, id) {
    const template = await OtTemplateModel.findById(id, companyId);
    if (!template) {
      throw new AppError("ไม่พบข้อมูลรูปแบบ OT", 404);
    }
    return template;
  }

  // ==============================================================
  // อัปเดตแม่แบบการทำงานล่วงเวลา
  async updateOtTemplate(user, id, updateData, ipAddress) {
    const companyId = user.company_id;

    const oldTemplate = await OtTemplateModel.findById(id, companyId);
    if (!oldTemplate) {
      throw new AppError("ไม่พบข้อมูลรูปแบบ OT", 404);
    }

    const { company_id, ...cleanData } = updateData;

    if (Object.keys(cleanData).length === 0) return oldTemplate;

    await OtTemplateModel.update(id, companyId, cleanData);

    const newTemplate = { ...oldTemplate, ...cleanData };

    // Audit
    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "ot_templates",
        recordId: id,
        oldVal: oldTemplate,
        newVal: newTemplate,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return newTemplate;
  }

  // ==============================================================
  // ลบแม่แบบการทำงานล่วงเวลา (Soft Delete)
  async softDeleteOtTemplate(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldTemplate = await OtTemplateModel.findById(id, companyId);
    if (!oldTemplate) {
      throw new AppError("ไม่พบข้อมูลรูปแบบ OT", 404);
    }

    await OtTemplateModel.softDelete(id, companyId);

    // Audit
    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "DELETE",
        table: "ot_templates",
        recordId: id,
        oldVal: oldTemplate,
        newVal: { ...oldTemplate, deleted_at: new Date(), is_active: 0 },
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }

  // ==============================================================
  // ลบแม่แบบการทำงานล่วงเวลา
  async deleteOtTemplate(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldTemplate = await OtTemplateModel.findById(id, companyId);
    if (!oldTemplate) {
      throw new AppError("ไม่พบข้อมูลรูปแบบ OT", 404);
    }

    await OtTemplateModel.delete(id, companyId);

    // Audit
    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "DELETE",
        table: "ot_templates",
        recordId: id,
        oldVal: oldTemplate,
        newVal: null,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }

  // ==============================================================
  // ดึงรายชื่อแม่แบบการทำงานล่วงเวลาเฉพาะที่ถูกลบแบบ soft delete
  async getDeletedOtTemplates(companyId, query) {
    const { page = 1, limit = 20, search } = query;
    const offset = (page - 1) * limit;
    const filters = { search };

    const templates = await OtTemplateModel.findAllDeleted(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await OtTemplateModel.countAllDeleted(companyId, filters);

    return {
      templates,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // กู้คืนแม่แบบการทำงานล่วงเวลาที่ถูกลบแบบ soft delete
  async restoreOtTemplate(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldTemplate = await OtTemplateModel.findDeletedById(id, companyId);
    if (!oldTemplate) {
      throw new AppError("ไม่พบข้อมูลรูปแบบ OT", 404);
    }

    await OtTemplateModel.restore(id, companyId);

    // Audit
    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "ot_templates",
        recordId: id,
        oldVal: oldTemplate,
        newVal: { ...oldTemplate, deleted_at: null, is_active: 1 },
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }
}

module.exports = new OtTemplateService();
