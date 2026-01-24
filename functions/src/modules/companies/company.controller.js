const CompanyService = require("./company.service");
const catchAsync = require("../../utils/catchAsync");

// Company Controller
class CompanyController {
  // ==============================================================
  // ดึงข้อมูลโปรไฟล์บริษัท
  getProfile = catchAsync(async (req, res, next) => {
    const company = await CompanyService.getCompanyProfile(req.user.company_id);

    res.status(200).json({
      status: "success",
      data: { company },
    });
  });

  // ==============================================================
  // อัปเดตข้อมูลโปรไฟล์บริษัท
  updateProfile = catchAsync(async (req, res, next) => {
    const updatedCompany = await CompanyService.updateCompanyProfile(
      req.user,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { company: updatedCompany },
    });
  });
}

module.exports = new CompanyController();
