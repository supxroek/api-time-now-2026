const ShiftPatternService = require("./shift_pattern.service");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");

// Shift Pattern Controller
class ShiftPatternController {
  // ==============================================================
  // สร้างรูปแบบกะการทำงาน
  create = catchAsync(async (req, res, next) => {
    if (!req.body.name) {
      return next(new AppError("กรุณาระบุชื่อรูปแบบกะการทำงาน", 400));
    }

    const pattern = await ShiftPatternService.createShiftPattern(
      req.user,
      req.body,
      req.ip,
    );

    res.status(201).json({
      status: "success",
      data: { pattern },
    });
  });

  // ==============================================================
  // ดึงข้อมูลรูปแบบกะการทำงานทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await ShiftPatternService.getAllShiftPatterns(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // ดึงข้อมูลรูปแบบกะการทำงานคนเดียวตาม ID
  getOne = catchAsync(async (req, res, next) => {
    const pattern = await ShiftPatternService.getShiftPatternById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { pattern },
    });
  });

  // ==============================================================
  // อัปเดตข้อมูลรูปแบบกะการทำงาน
  update = catchAsync(async (req, res, next) => {
    const updatedPattern = await ShiftPatternService.updateShiftPattern(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { pattern: updatedPattern },
    });
  });

  // ==============================================================
  // ลบรูปแบบกะการทำงาน (soft delete)
  softDelete = catchAsync(async (req, res, next) => {
    await ShiftPatternService.softDeleteShiftPattern(
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
  // ลบรูปแบบกะการทำงาน
  delete = catchAsync(async (req, res, next) => {
    await ShiftPatternService.deleteShiftPattern(
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
  // ดึงรายชื่อรูปแบบกะที่ถูกลบแบบ soft delete
  getDeletedPatterns = catchAsync(async (req, res, next) => {
    const result = await ShiftPatternService.getDeletedPatterns(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // กู้คืนรูปแบบกะที่ถูกลบแบบ soft delete
  restore = catchAsync(async (req, res, next) => {
    const restoredPattern = await ShiftPatternService.restoreShiftPattern(
      req.user,
      req.params.id,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { pattern: restoredPattern },
    });
  });
}

module.exports = new ShiftPatternController();
