/**
 * /src/modules/companies/company.routes.js
 *
 * Company Service
 * จัดการ logic ที่เกี่ยวกับบริษัทต่างๆ
 */

// import models and utilities
const pool = require("../../config/database");
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
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบ companyId
      if (!companyId) {
        throw new Error("Company ID is required");
      }
      // อัปเดตข้อมูลบริษัทในฐานข้อมูล
      const updatedCompany = await companyModel.updateCompany(
        companyId,
        updateData
      );
      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      return updatedCompany;
    } catch (error) {
      // rollback transaction - กรณีเกิดข้อผิดพลาด: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }
}

module.exports = new CompanyService();
