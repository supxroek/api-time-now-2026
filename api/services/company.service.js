/**
 * /api/services/company.service.js
 *
 * Company Service - Business Logic Layer
 * จัดการ logic ที่เกี่ยวกับข้อมูลบริษัท
 */

const Company = require("../models/company.model");

class CompanyService {
  /**
   * ดึงข้อมูล Profile ของบริษัท
   * @param {number} companyId
   * @returns {Promise<Object>}
   */
  async getProfile(companyId) {
    const company = await Company.findWithEmployeeStats(companyId);

    if (!company) {
      const error = new Error("Company not found");
      error.statusCode = 404;
      throw error;
    }

    return company;
  }

  /**
   * อัพเดทข้อมูล Profile ของบริษัท
   * @param {number} companyId
   * @param {Object} data - ข้อมูลที่ต้องการอัพเดท
   * @returns {Promise<Object>}
   */
  async updateProfile(companyId, data) {
    // ตรวจสอบว่าบริษัทมีอยู่จริง
    const company = await Company.findById(companyId);
    if (!company) {
      const error = new Error("Company not found");
      error.statusCode = 404;
      throw error;
    }

    // อัพเดทข้อมูล
    const updated = await Company.update(companyId, data);

    // ดึงข้อมูลพร้อมสถิติใหม่
    return Company.findWithEmployeeStats(companyId);
  }

  /**
   * ดึง Settings สำหรับ Report
   * @param {number} companyId
   * @returns {Promise<Object>}
   */
  async getReportSettings(companyId) {
    const settings = await Company.getReportSettings(companyId);

    if (!settings) {
      const error = new Error("Company not found");
      error.statusCode = 404;
      throw error;
    }

    return settings;
  }

  /**
   * ตรวจสอบสถานะ Subscription
   * @param {number} companyId
   * @returns {Promise<Object>}
   */
  async checkSubscription(companyId) {
    const subscription = await Company.checkSubscription(companyId);

    if (!subscription) {
      const error = new Error("Company not found");
      error.statusCode = 404;
      throw error;
    }

    return subscription;
  }
}

module.exports = new CompanyService();
