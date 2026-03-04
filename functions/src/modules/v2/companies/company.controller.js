const catchAsync = require("../../../utils/catchAsync");
const CompanyService = require("./company.service");

class CompanyController {
  getOverview = catchAsync(async (req, res, _next) => {
    const overview = await CompanyService.getOverview(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: overview,
    });
  });

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
