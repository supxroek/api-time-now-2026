/**
 * /src/modules/companies/company.routes.js
 *
 * Company Service
 * จัดการ logic ที่เกี่ยวกับบริษัทต่างๆ
 */

// import models and utilities
const companyModel = require("./company.model");

// Service Class
class CompanyService {
  // business logic for fetching companies with filters
  async getCompanyById(companyId) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("Company ID is required");
    }
    // ดึงข้อมูลบริษัทจากฐานข้อมูลตาม companyId
    const company = await companyModel.findCompanyById(companyId);
    return company;
  }

  // business logic for updating company information
  async updateCompany(companyId, updateData) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("Company ID is required");
    }
    // อัปเดตข้อมูลบริษัทในฐานข้อมูล
    const updatedCompany = await companyModel.updateCompany(
      companyId,
      updateData
    );
    return updatedCompany;
  }
}

module.exports = new CompanyService();
