const catchAsync = require("../../../utils/catchAsync");
const OtTemplateService = require("./ot_template.service");

class OtTemplateController {
  create = catchAsync(async (req, res, _next) => {
    const template = await OtTemplateService.createTemplate(
      req.user,
      req.body,
      req.ip,
    );
    res.status(201).json({
      status: "success",
      data: { template },
    });
  });

  getAll = catchAsync(async (req, res, _next) => {
    const result = await OtTemplateService.getAllTemplates(
      req.user.company_id,
      req.query,
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getOne = catchAsync(async (req, res, _next) => {
    const template = await OtTemplateService.getTemplateById(
      req.user.company_id,
      req.params.id,
    );
    res.status(200).json({
      status: "success",
      data: { template },
    });
  });

  update = catchAsync(async (req, res, _next) => {
    const template = await OtTemplateService.updateTemplate(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );
    res.status(200).json({
      status: "success",
      data: { template },
    });
  });

  delete = catchAsync(async (req, res, _next) => {
    await OtTemplateService.deleteTemplate(req.user, req.params.id, req.ip);
    res.status(204).json({
      status: "success",
      data: null,
    });
  });

  restore = catchAsync(async (req, res, _next) => {
    const template = await OtTemplateService.restoreTemplate(
      req.user,
      req.params.id,
      req.ip,
    );
    res.status(200).json({
      status: "success",
      data: { template },
    });
  });
}

module.exports = new OtTemplateController();
