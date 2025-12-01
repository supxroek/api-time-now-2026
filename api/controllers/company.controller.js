/**
 * /api/controllers/company.controller.js
 *
 * Company Controller
 * จัดการ request/response สำหรับ Company endpoints
 */

const companyService = require("../services/company.service");

class CompanyController {
  /**
   * GET /company/profile
   * ดึงข้อมูล Profile ของบริษัท
   */
  async getProfile(req, res, next) {
    try {
      const companyId = req.companyId; // จาก auth middleware

      const company = await companyService.getProfile(companyId);

      res.json({
        success: true,
        data: company,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /company/profile
   * แก้ไขข้อมูล Profile ของบริษัท
   */
  async updateProfile(req, res, next) {
    try {
      const companyId = req.companyId;
      const data = req.body;

      const company = await companyService.updateProfile(companyId, data);

      res.json({
        success: true,
        message: "Company profile updated successfully",
        data: company,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /company/subscription
   * ดึงสถานะ Subscription
   */
  async getSubscription(req, res, next) {
    try {
      const companyId = req.companyId;

      const subscription = await companyService.checkSubscription(companyId);

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CompanyController();
