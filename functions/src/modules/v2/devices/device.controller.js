const catchAsync = require("../../../utils/catchAsync");
const AppError = require("../../../utils/AppError");
const DeviceService = require("./device.service");

class DeviceController {
  create = catchAsync(async (req, res, next) => {
    if (!req.body.name || !req.body.hwid) {
      return next(new AppError("กรุณาระบุชื่ออุปกรณ์และ HWID", 400));
    }

    const device = await DeviceService.createDevice(req.user, req.body, req.ip);
    res.status(201).json({
      status: "success",
      data: { device },
    });
  });

  getAll = catchAsync(async (req, res, _next) => {
    const result = await DeviceService.getAllDevices(
      req.user.company_id,
      req.query,
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getOne = catchAsync(async (req, res, _next) => {
    const device = await DeviceService.getDeviceById(
      req.user.company_id,
      req.params.id,
    );
    res.status(200).json({
      status: "success",
      data: { device },
    });
  });

  update = catchAsync(async (req, res, _next) => {
    const device = await DeviceService.updateDevice(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { device },
    });
  });

  delete = catchAsync(async (req, res, _next) => {
    await DeviceService.deleteDevice(req.user, req.params.id, req.ip);
    res.status(204).json({
      status: "success",
      data: null,
    });
  });

  getAccessControls = catchAsync(async (req, res, _next) => {
    const result = await DeviceService.getAccessControls(
      req.user,
      req.params.id,
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  addAccessControl = catchAsync(async (req, res, _next) => {
    const accessControl = await DeviceService.addAccessControl(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(201).json({
      status: "success",
      data: { accessControl },
    });
  });

  removeAccessControl = catchAsync(async (req, res, _next) => {
    await DeviceService.removeAccessControl(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );
    res.status(204).json({
      status: "success",
      data: null,
    });
  });
}

module.exports = new DeviceController();
