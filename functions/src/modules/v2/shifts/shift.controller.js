const catchAsync = require("../../../utils/catchAsync");
const AppError = require("../../../utils/AppError");
const ShiftService = require("./shift.service");

class ShiftController {
  create = catchAsync(async (req, res, next) => {
    if (!req.body.name) {
      return next(new AppError("กรุณาระบุชื่อกะการทำงาน", 400));
    }

    const shift = await ShiftService.createShift(req.user, req.body, req.ip);
    res.status(201).json({
      status: "success",
      data: { shift },
    });
  });

  getAll = catchAsync(async (req, res, _next) => {
    const result = await ShiftService.getAllShifts(
      req.user.company_id,
      req.query,
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getOne = catchAsync(async (req, res, _next) => {
    const shift = await ShiftService.getShiftById(
      req.user.company_id,
      req.params.id,
    );
    res.status(200).json({
      status: "success",
      data: { shift },
    });
  });

  update = catchAsync(async (req, res, _next) => {
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

  delete = catchAsync(async (req, res, _next) => {
    await ShiftService.deleteShift(req.user, req.params.id, req.ip);

    res.status(204).json({
      status: "success",
      data: null,
    });
  });

  restore = catchAsync(async (req, res, _next) => {
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
}

module.exports = new ShiftController();
