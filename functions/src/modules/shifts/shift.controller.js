const ShiftService = require("./shift.service");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");

// Shift Controller
class ShiftController {
  // ==============================================================
  // สร้างกะการทำงานใหม่
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

  // ==============================================================
  // ดึงข้อมูลกะการทำงานทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await ShiftService.getAllShifts(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // ดึงข้อมูลกะการทำงานคนเดียวตาม ID
  getOne = catchAsync(async (req, res, next) => {
    const shift = await ShiftService.getShiftById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { shift },
    });
  });

  // ==============================================================
  // อัปเดตข้อมูลกะการทำงาน
  update = catchAsync(async (req, res, next) => {
    const updatedShift = await ShiftService.updateShift(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { shift: updatedShift },
    });
  });

  // ==============================================================
  // ลบกะการทำงาน
  delete = catchAsync(async (req, res, next) => {
    await ShiftService.deleteShift(req.user, req.params.id, req.ip);

    res.status(204).json({
      status: "success",
      data: null,
    });
  });
}

module.exports = new ShiftController();
