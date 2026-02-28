const catchAsync = require("../../../utils/catchAsync");
const AppError = require("../../../utils/AppError");
const ShiftService = require("./shift.service");

class ShiftController {
  createShift = catchAsync(async (req, res, next) => {
    if (!req.body.name) {
      return next(new AppError("กรุณาระบุชื่อกะการทำงาน", 400));
    }

    const shift = await ShiftService.createShift(req.user, req.body, req.ip);
    res.status(201).json({
      status: "success",
      data: { shift },
    });
  });

  getAllShifts = catchAsync(async (req, res, _next) => {
    const result = await ShiftService.getAllShifts(
      req.user.company_id,
      req.query,
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getShiftById = catchAsync(async (req, res, _next) => {
    const shift = await ShiftService.getShiftById(
      req.user.company_id,
      req.params.id,
    );
    res.status(200).json({
      status: "success",
      data: { shift },
    });
  });

  updateShift = catchAsync(async (req, res, _next) => {
    const shift = await ShiftService.updateShift(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );
    res.status(200).json({
      status: "success",
      data: { shift },
    });
  });

  deleteShift = catchAsync(async (req, res, _next) => {
    await ShiftService.deleteShift(req.user, req.params.id, req.ip);
    res.status(204).json({
      status: "success",
      data: null,
    });
  });

  restoreShift = catchAsync(async (req, res, _next) => {
    const shift = await ShiftService.restoreShift(
      req.user,
      req.params.id,
      req.ip,
    );
    res.status(200).json({
      status: "success",
      data: { shift },
    });
  });

  getAssignments = catchAsync(async (req, res, _next) => {
    const result = await ShiftService.getAssignments(
      req.user.company_id,
      req.query,
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getAssignmentById = catchAsync(async (req, res, _next) => {
    const assignment = await ShiftService.getAssignmentById(
      req.user.company_id,
      req.params.id,
    );
    res.status(200).json({
      status: "success",
      data: { assignment },
    });
  });

  createAssignment = catchAsync(async (req, res, _next) => {
    const assignment = await ShiftService.createAssignment(
      req.user,
      req.body,
      req.ip,
    );
    res.status(201).json({
      status: "success",
      data: { assignment },
    });
  });

  updateAssignment = catchAsync(async (req, res, _next) => {
    const assignment = await ShiftService.updateAssignment(
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

  deleteAssignment = catchAsync(async (req, res, _next) => {
    await ShiftService.deleteAssignment(req.user, req.params.id, req.ip);
    res.status(204).json({
      status: "success",
      data: null,
    });
  });

  getCustomDays = catchAsync(async (req, res, _next) => {
    const result = await ShiftService.getCustomDays(
      req.user.company_id,
      req.query,
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getCustomDayById = catchAsync(async (req, res, _next) => {
    const customDay = await ShiftService.getCustomDayById(
      req.user.company_id,
      req.params.id,
    );
    res.status(200).json({
      status: "success",
      data: { customDay },
    });
  });

  createCustomDay = catchAsync(async (req, res, _next) => {
    const customDay = await ShiftService.createCustomDay(
      req.user,
      req.body,
      req.ip,
    );
    res.status(201).json({
      status: "success",
      data: { customDay },
    });
  });

  updateCustomDay = catchAsync(async (req, res, _next) => {
    const customDay = await ShiftService.updateCustomDay(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );
    res.status(200).json({
      status: "success",
      data: { customDay },
    });
  });

  deleteCustomDay = catchAsync(async (req, res, _next) => {
    await ShiftService.deleteCustomDay(req.user, req.params.id, req.ip);
    res.status(204).json({
      status: "success",
      data: null,
    });
  });
}

module.exports = new ShiftController();
