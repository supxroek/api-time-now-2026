const catchAsync = require("../../../utils/catchAsync");
const DepartmentService = require("./department.service");

class DepartmentController {
  getOverview = catchAsync(async (req, res, _next) => {
    const result = await DepartmentService.getOverview(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  create = catchAsync(async (req, res, _next) => {
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

  getAll = catchAsync(async (req, res, _next) => {
    const result = await DepartmentService.getAllDepartments(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getOne = catchAsync(async (req, res, _next) => {
    const department = await DepartmentService.getDepartmentById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { department },
    });
  });

  update = catchAsync(async (req, res, _next) => {
    const department = await DepartmentService.updateDepartment(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { department },
    });
  });

  delete = catchAsync(async (req, res, _next) => {
    await DepartmentService.deleteDepartment(req.user, req.params.id, req.ip);

    res.status(204).json({
      status: "success",
      data: null,
    });
  });
}

module.exports = new DepartmentController();
