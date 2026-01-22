const BranchService = require("./branch.service");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");

// Branch Controller
class BranchController {
  // ==============================================================
  // สร้างสาขาใหม่
  create = catchAsync(async (req, res, next) => {
    if (!req.body.branch_name) {
      return next(new AppError("กรุณาระบุชื่อสาขา", 400));
    }

    const branch = await BranchService.createBranch(req.user, req.body, req.ip);

    res.status(201).json({
      status: "success",
      data: { branch },
    });
  });

  // ==============================================================
  // ดึงข้อมูลสาขาทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await BranchService.getAllBranches(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // ดึงข้อมูลสาขาคนเดียวตาม ID
  getOne = catchAsync(async (req, res, next) => {
    const branch = await BranchService.getBranchById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { branch },
    });
  });

  // ==============================================================
  // อัปเดตข้อมูลสาขา
  update = catchAsync(async (req, res, next) => {
    const updatedBranch = await BranchService.updateBranch(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { branch: updatedBranch },
    });
  });

  // ==============================================================
  // ลบสาขา
  delete = catchAsync(async (req, res, next) => {
    await BranchService.deleteBranch(req.user, req.params.id, req.ip);

    res.status(204).json({
      status: "success",
      data: null,
    });
  });
}

module.exports = new BranchController();
