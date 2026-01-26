const CompanyModulesService = require("./comapny_settings.service");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");

// Company Modules Controller
class CompanyModulesController {
  // ==============================================================
  // ดึงรายการโมดูลบริษัททั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await CompanyModulesService.getAllCompanyModules(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // ดึงข้อมูลโมดูลบริษัทรายบุคคล
  getOne = catchAsync(async (req, res, next) => {
    const module = await CompanyModulesService.getCompanyModuleById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { module },
    });
  });

  // ==============================================================
  // อัปเดตข้อมูลโมดูลบริษัทรายบุคคล
  update = catchAsync(async (req, res, next) => {
    if (req.body.config && typeof req.body.config !== "object") {
      return next(
        new AppError("ข้อมูล config ต้องเป็นรูปแบบ object เท่านั้น", 400),
      );
    }

    const updatedModule = await CompanyModulesService.updateCompanyModule(
      req.user,
      req.params.id,
      req.body,
    );

    res.status(200).json({
      status: "success",
      data: { module: updatedModule },
    });
  });
}

module.exports = new CompanyModulesController();
