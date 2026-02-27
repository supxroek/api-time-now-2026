const catchAsync = require("../../../utils/catchAsync");
const UserService = require("./user.service");

class UserController {
  getAll = catchAsync(async (req, res, _next) => {
    const result = await UserService.getAllUsers(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  updateRole = catchAsync(async (req, res, _next) => {
    const user = await UserService.updateRole(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { user },
    });
  });

  updateStatus = catchAsync(async (req, res, _next) => {
    const user = await UserService.updateStatus(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { user },
    });
  });
}

module.exports = new UserController();
