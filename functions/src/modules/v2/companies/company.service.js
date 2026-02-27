const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const CompanyModel = require("./company.model");

class CompanyService {
  static ALLOWED_UPDATE_FIELDS = new Set([
    "name",
    "tax_id",
    "email",
    "phone_number",
    "contact_person",
    "address_detail",
    "sub_district",
    "district",
    "province",
    "postal_code",
    "hr_employee_id",
    "report_date",
    "employee_limit",
  ]);

  filterAllowedFields(payload) {
    const filtered = {};

    Object.keys(payload || {}).forEach((key) => {
      if (CompanyService.ALLOWED_UPDATE_FIELDS.has(key)) {
        filtered[key] = payload[key];
      }
    });

    return filtered;
  }

  validateUpdateData(data) {
    if (
      data.report_date !== undefined &&
      (data.report_date < 1 || data.report_date > 31)
    ) {
      throw new AppError("report_date ต้องอยู่ในช่วง 1 ถึง 31", 400);
    }

    if (
      data.employee_limit !== undefined &&
      data.employee_limit !== null &&
      data.employee_limit < 1
    ) {
      throw new AppError("employee_limit ต้องมากกว่าหรือเท่ากับ 1", 400);
    }
  }

  async getCompanyProfile(companyId) {
    const company = await CompanyModel.findProfileByCompanyId(companyId);
    if (!company) {
      throw new AppError("ไม่พบบริษัท", 404);
    }

    return company;
  }

  async updateCompanyProfile(user, payload, ipAddress) {
    const companyId = user.company_id;
    const oldCompany = await CompanyModel.findProfileByCompanyId(companyId);

    if (!oldCompany) {
      throw new AppError("ไม่พบบริษัท", 404);
    }

    const cleanData = this.filterAllowedFields(payload);
    this.validateUpdateData(cleanData);

    if (!Object.keys(cleanData).length) {
      return oldCompany;
    }

    await CompanyModel.updateProfileByCompanyId(companyId, cleanData);
    const updatedCompany = await CompanyModel.findProfileByCompanyId(companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "companies",
        recordId: companyId,
        oldVal: oldCompany,
        newVal: updatedCompany,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 companies):", error);
    }

    return updatedCompany;
  }
}

module.exports = new CompanyService();
