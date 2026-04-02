const catchAsync = require("../../../utils/catchAsync");
const OffsiteAssignmentService = require("./offsite_assignment.service");

class OffsiteAssignmentController {
  getOverview = catchAsync(async (req, res, _next) => {
    const result = await OffsiteAssignmentService.getOverview(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  create = catchAsync(async (req, res, _next) => {
    const assignment = await OffsiteAssignmentService.createAssignment(
      req.user,
      req.body,
      req.ip,
    );

    res.status(201).json({
      status: "success",
      data: { assignment },
    });
  });

  getOne = catchAsync(async (req, res, _next) => {
    const OffsiteAssignmentModel = require("./offsite_assignment.model");
    const AppError = require("../../../utils/AppError");

    const item = await OffsiteAssignmentModel.findByIdAndCompanyId(
      req.params.id,
      req.user.company_id,
    );

    if (!item) {
      throw new AppError("ไม่พบข้อมูลงานนอกสถานที่", 404);
    }

    res.status(200).json({
      status: "success",
      data: { assignment: item },
    });
  });

  update = catchAsync(async (req, res, _next) => {
    const assignment = await OffsiteAssignmentService.updateAssignment(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { assignment },
    });
  });

  delete = catchAsync(async (req, res, _next) => {
    await OffsiteAssignmentService.deleteAssignment(
      req.user,
      req.params.id,
      req.ip,
    );

    res.status(204).json({
      status: "success",
      data: null,
    });
  });
}

module.exports = new OffsiteAssignmentController();
