const EmployeeService = require("./employee.service");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");

// Employee Controller
class EmployeeController {
  // ==============================================================
  // สร้างพนักงานใหม่
  create = catchAsync(async (req, res, next) => {
    // Basic Validation
    if (!req.body.name || !req.body.email) {
      return next(new AppError("กรุณาระบุชื่อและอีเมลพนักงาน", 400));
    }

    // สร้างพนักงานใหม่ (เรียกใช้ Service)
    const employee = await EmployeeService.createEmployee(
      req.user,
      req.body,
      req.ip,
    );

    // ตอบกลับผลลัพธ์
    res.status(201).json({
      status: "success",
      data: { employee },
    });
  });

  // ==============================================================
  // ดึงข้อมูลพนักงานทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await EmployeeService.getAllEmployees(
      req.user.company_id,
      req.query,
    );

    // ตอบกลับผลลัพธ์
    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // ดึงข้อมูลพนักงานคนเดียวตาม ID
  getOne = catchAsync(async (req, res, next) => {
    const employee = await EmployeeService.getEmployeeById(
      req.user.company_id,
      req.params.id,
    );

    // ตอบกลับผลลัพธ์
    res.status(200).json({
      status: "success",
      data: { employee },
    });
  });

  // ==============================================================
  // อัปเดตข้อมูลพนักงาน
  update = catchAsync(async (req, res, next) => {
    const updatedEmployee = await EmployeeService.updateEmployee(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    // ตอบกลับผลลัพธ์
    res.status(200).json({
      status: "success",
      data: { employee: updatedEmployee },
    });
  });

  // ==============================================================
  // ลบพนักงาน
  delete = catchAsync(async (req, res, next) => {
    await EmployeeService.deleteEmployee(req.user, req.params.id, req.ip);

    // ตอบกลับผลลัพธ์
    res.status(204).json({
      status: "success",
      data: [],
    });
  });
}

module.exports = new EmployeeController();
