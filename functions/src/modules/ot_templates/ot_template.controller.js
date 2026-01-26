const OtTemplateService = require("./ot_template.service");
const catchAsync = require("../../utils/catchAsync");

// OT Template Controller
class OtTemplateController {
  // ==============================================================
  // สร้างแม่แบบการทำงานล่วงเวลาใหม่
  create = catchAsync(async (req, res, next) => {
    const template = await OtTemplateService.createOtTemplate(
      req.user,
      req.body,
      req.ip,
    );
    res.status(201).json({ status: "success", data: { template } });
  });

  // ==============================================================
  // ดึงแม่แบบการทำงานล่วงเวลาทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await OtTemplateService.getAllOtTemplates(
      req.user.company_id,
      req.query,
    );
    res.status(200).json({ status: "success", data: result });
  });

  // ==============================================================
  // ดึงแม่แบบการทำงานล่วงเวลาโดย ID
  getOne = catchAsync(async (req, res, next) => {
    const template = await OtTemplateService.getOtTemplateById(
      req.user.company_id,
      req.params.id,
    );
    res.status(200).json({ status: "success", data: { template } });
  });

  // ==============================================================
  // อัปเดตแม่แบบการทำงานล่วงเวลา
  update = catchAsync(async (req, res, next) => {
    const template = await OtTemplateService.updateOtTemplate(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );
    res.status(200).json({ status: "success", data: { template } });
  });

  // ==============================================================
  // ลบแม่แบบการทำงานล่วงเวลา (soft delete)
  softDelete = catchAsync(async (req, res, next) => {
    await OtTemplateService.softDeleteOtTemplate(
      req.user,
      req.params.id,
      req.ip,
    );

    res.status(204).json({
      status: "success",
      data: null,
    });
  });

  // ==============================================================
  // ลบแม่แบบการทำงานล่วงเวลา
  delete = catchAsync(async (req, res, next) => {
    await OtTemplateService.deleteOtTemplate(req.user, req.params.id, req.ip);

    res.status(204).json({
      status: "success",
      data: null,
    });
  });

  // ==============================================================
  // ดึงรายชื่อแม่แบบการทำงานล่วงเวลาที่ถูกลบแบบ soft delete
  getDeletedTemplates = catchAsync(async (req, res, next) => {
    const result = await OtTemplateService.getDeletedOtTemplates(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // กู้คืนแม่แบบการทำงานล่วงเวลาที่ถูกลบแบบ soft delete
  restore = catchAsync(async (req, res, next) => {
    const restoredTemplate = await OtTemplateService.restoreOtTemplate(
      req.user,
      req.params.id,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { template: restoredTemplate },
    });
  });
}

module.exports = new OtTemplateController();
