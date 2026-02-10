const DeviceService = require("./device.service");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");

// Device Controller
class DeviceController {
  // ==============================================================
  // สร้างอุปกรณ์ใหม่
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

  // ==============================================================
  // ดึงข้อมูลอุปกรณ์ทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await DeviceService.getAllDevices(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // ดึงข้อมูลอุปกรณ์คนเดียวตาม ID
  getOne = catchAsync(async (req, res, next) => {
    const device = await DeviceService.getDeviceById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { device },
    });
  });

  // ==============================================================
  // อัปเดตข้อมูลอุปกรณ์
  update = catchAsync(async (req, res, next) => {
    const updatedDevice = await DeviceService.updateDevice(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { device: updatedDevice },
    });
  });

  // ==============================================================
  // ลบอุปกรณ์แบบนุ่มนวล (soft delete)
  softDelete = catchAsync(async (req, res, next) => {
    await DeviceService.softDeleteDevice(req.user, req.params.id, req.ip);

    res.status(204).json({
      status: "success",
      data: null,
    });
  });

  // ==============================================================
  // ลบอุปกรณ์
  delete = catchAsync(async (req, res, next) => {
    await DeviceService.deleteDevice(req.user, req.params.id, req.ip);

    res.status(204).json({
      status: "success",
      data: null,
    });
  });

  // ==============================================================
  // ดึงรายชื่ออุปกรณ์เฉพาะที่ถูกลบแบบ soft delete
  getDeletedDevices = catchAsync(async (req, res, next) => {
    const result = await DeviceService.getDeletedDevices(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // กู้คืนอุปกรณ์ที่ถูกลบแบบ soft delete
  restore = catchAsync(async (req, res, next) => {
    const restoredDevice = await DeviceService.restoreDevice(
      req.user,
      req.params.id,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { device: restoredDevice },
    });
  });

  // ==============================================================
  // อนุญาตการเข้าถึงอุปกรณ์
  grantAccess = catchAsync(async (req, res, next) => {
    await DeviceService.grantDeviceAccess(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: null,
    });
  });

  // ==============================================================
  // เพิกถอนการเข้าถึงอุปกรณ์
  revokeAccess = catchAsync(async (req, res, next) => {
    await DeviceService.revokeDeviceAccess(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: null,
    });
  });

  // ==============================================================
  // ดึงรายการสิทธิ์ของอุปกรณ์
  getAccessControls = catchAsync(async (req, res, next) => {
    const controls = await DeviceService.getDeviceAccessControls(
      req.user,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { controls },
    });
  });
}

module.exports = new DeviceController();
