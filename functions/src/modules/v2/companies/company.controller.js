const catchAsync = require("../../../utils/catchAsync");
const CompanyService = require("./company.service");

class CompanyController {
  getProfile = catchAsync(async (req, res, _next) => {
    const company = await CompanyService.getCompanyProfile(req.user.company_id);

    res.status(200).json({
      status: "success",
      data: { company },
    });
  });

  updateProfile = catchAsync(async (req, res, _next) => {
    const company = await CompanyService.updateCompanyProfile(
      req.user,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { company },
    });
  });
}

module.exports = new CompanyController();
