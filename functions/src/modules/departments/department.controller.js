const DepartmentService = require("./department.service");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");

// Department Controller
class DepartmentController {
  // ==============================================================
  // สร้างแผนกใหม่
  create = catchAsync(async (req, res, next) => {
    if (!req.body.department_name) {
      return next(new AppError("กรุณาระบุชื่อแผนก", 400));
    }

    const department = await DepartmentService.createDepartment(
      req.user,
      req.body,
      req.ip,
    );

    res.status(201).json({
      status: "success",
      data: { department },
    });
  });

  // ==============================================================
  // ดึงข้อมูลแผนกทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await DepartmentService.getAllDepartments(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // ดึงข้อมูลแผนกคนเดียวตาม ID
  getOne = catchAsync(async (req, res, next) => {
    const department = await DepartmentService.getDepartmentById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { department },
    });
  });

  // ==============================================================
  // อัปเดตข้อมูลแผนก
  update = catchAsync(async (req, res, next) => {
    const updatedDept = await DepartmentService.updateDepartment(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { department: updatedDept },
    });
  });

  // ==============================================================
  // ลบแผนก
  delete = catchAsync(async (req, res, next) => {
    await DepartmentService.deleteDepartment(req.user, req.params.id, req.ip);

    res.status(204).json({
      status: "success",
      data: null,
    });
  });
}

module.exports = new DepartmentController();
