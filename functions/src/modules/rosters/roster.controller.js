const RosterService = require("./roster.service");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");

// Roster Controller
class RosterController {
  // ==============================================================
  // สร้างตารางเวรใหม่
  create = catchAsync(async (req, res, next) => {
    if (!req.body.employee_id || !req.body.shift_id || !req.body.work_date) {
      return next(
        new AppError("กรุณาระบุพนักงาน, กะการทำงาน และวันที่ทำงาน", 400),
      );
    }

    const roster = await RosterService.createRoster(req.user, req.body, req.ip);

    res.status(201).json({
      status: "success",
      data: { roster },
    });
  });

  // ==============================================================
  // ดึงข้อมูลตารางเวรทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await RosterService.getAllRosters(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // ดึงข้อมูลตารางเวรคนเดียวตาม ID
  getOne = catchAsync(async (req, res, next) => {
    const roster = await RosterService.getRosterById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { roster },
    });
  });

  // ==============================================================
  // อัปเดตข้อมูลตารางเวร
  update = catchAsync(async (req, res, next) => {
    const updatedRoster = await RosterService.updateRoster(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { roster: updatedRoster },
    });
  });

  // ==============================================================
  // ลบตารางเวร
  delete = catchAsync(async (req, res, next) => {
    await RosterService.deleteRoster(req.user, req.params.id, req.ip);

    res.status(204).json({
      status: "success",
      data: null,
    });
  });
}

module.exports = new RosterController();
