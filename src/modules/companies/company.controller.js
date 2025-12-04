/**
 * /src/modules/companies/company.routes.js
 *
 * Company Controller
 * ชั้นควบคุมสำหรับการจัดการคำขอที่เกี่ยวกับบริษัท
 */

// import services and helpers
const companyService = require("./company.service");

// Controller Class
class CompanyController {
  // GET /api/companies/profile
  async getCompanies(req, res) {
    // ดึงข้อมูลบริษัทของผู้ใช้จาก req.user.company_id
    try {
      const companyId = req.user?.company_id;
      const company = await companyService.getCompanyById(companyId);
      res.status(200).json({
        success: true,
        data: company,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  // PUT /api/companies/profile
  async updateCompany(req, res) {
    // อัปเดตข้อมูลบริษัทของผู้ใช้จาก req.user.company_id
    try {
      const companyId = req.user?.company_id;
      const updateData = req.body;
      const updatedCompany = await companyService.updateCompany(
        companyId,
        updateData
      );
      res.status(200).json({
        success: true,
        data: updatedCompany,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new CompanyController();
