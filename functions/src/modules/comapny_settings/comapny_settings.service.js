const CompanyModulesModel = require("./comapny_settings.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// Company Modules Service
class CompanyModulesService {
  // ==============================================================
  // ดึงรายการโมดูลบริษัททั้งหมด
  async getAllCompanyModules(companyId, query) {
    const { page = 1, limit = 20, search } = query;
    const offset = (page - 1) * limit;

    const filters = { search };

    const modules = await CompanyModulesModel.findAll(
      companyId,
      filters,
      limit,
      offset,
    );
    const total = await CompanyModulesModel.countAll(companyId, filters);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      total_pages: Math.ceil(total / limit),
      data: modules,
    };
  }

  // ==============================================================
  // ดึงข้อมูลโมดูลบริษัทรายบุคคลตาม ID
  async getCompanyModuleById(companyId, id) {
    const module = await CompanyModulesModel.findById(id, companyId);
    if (!module) {
      throw new AppError("ไม่พบข้อมูลโมดูลบริษัทที่ต้องการ", 404);
    }

    return module;
  }

  // ==============================================================
  // อัปเดตข้อมูลโมดูลบริษัทรายบุคคล
  async updateCompanyModule(user, id, updateData) {
    const companyId = user.company_id;
    const oldModule = await CompanyModulesModel.findById(id, companyId);
    if (!oldModule) {
      throw new AppError("ไม่พบข้อมูลโมดูลบริษัทที่ต้องการแก้ไข", 404);
    }

    const updatedModule = await CompanyModulesModel.updateById(
      id,
      companyId,
      updateData,
    );

    // บันทึก Audit Trail
    await auditRecord({
      company_id: companyId,
      user_id: user.id,
      action_type: "UPDATE",
      table_name: "company_modules",
      record_id: id,
      old_values: oldModule,
      new_values: updatedModule,
    });

    return updatedModule;
  }
}

module.exports = new CompanyModulesService();
