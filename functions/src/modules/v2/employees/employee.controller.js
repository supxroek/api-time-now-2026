const catchAsync = require("../../../utils/catchAsync");
const EmployeeService = require("./employee.service");

class EmployeeController {
  getAll = catchAsync(async (req, res, _next) => {
    const result = await EmployeeService.getAllEmployees(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getOne = catchAsync(async (req, res, _next) => {
    const employee = await EmployeeService.getEmployeeById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { employee },
    });
  });

  update = catchAsync(async (req, res, _next) => {
    const employee = await EmployeeService.updateEmployee(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { employee },
    });
  });

  delete = catchAsync(async (req, res, _next) => {
    await EmployeeService.deleteEmployee(req.user, req.params.id, req.ip);

    res.status(204).json({
      status: "success",
      data: null,
    });
  });
}

module.exports = new EmployeeController();
