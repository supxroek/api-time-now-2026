const DeviceModel = require("./device.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// Device Service
class DeviceService {
  // ==============================================================
  // สร้างอุปกรณ์ใหม่
  async createDevice(user, deviceData, ipAddress) {
    const companyId = user.company_id;
    const { company_id, ...cleanData } = deviceData;

    // Check duplicate HWID
    if (cleanData.hwid) {
      const existingDevice = await DeviceModel.findByHwid(cleanData.hwid);
      if (existingDevice) {
        throw new AppError(
          `HWID '${cleanData.hwid}' นี้ถูกลงทะเบียนไปแล้ว`,
          400,
        );
      }
    }

    const dataToCreate = {
      ...cleanData,
      company_id: companyId,
      is_active: cleanData.is_active === undefined ? 1 : cleanData.is_active,
    };

    const newDeviceId = await DeviceModel.create(dataToCreate);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "INSERT",
        table: "devices",
        recordId: newDeviceId,
        oldVal: null,
        newVal: dataToCreate,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return { id: newDeviceId, ...dataToCreate };
  }

  // ==============================================================
  // ดึงข้อมูลอุปกรณ์ทั้งหมด
  async getAllDevices(companyId, query) {
    const { page = 1, limit = 20, search, branch_id, is_active } = query;
    const offset = (page - 1) * limit;

    const filters = { search, branch_id, is_active };

    const devices = await DeviceModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await DeviceModel.countAll(companyId, filters);

    return {
      devices,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // ดึงข้อมูลอุปกรณ์คนเดียวตาม ID
  async getDeviceById(companyId, id) {
    const device = await DeviceModel.findById(id, companyId);
    if (!device) {
      throw new AppError("ไม่พบข้อมูลอุปกรณ์", 404);
    }
    return device;
  }

  // ==============================================================
  // อัปเดตข้อมูลอุปกรณ์
  async updateDevice(user, id, updateData, ipAddress) {
    const companyId = user.company_id;

    const oldDevice = await DeviceModel.findById(id, companyId);
    if (!oldDevice) {
      throw new AppError("ไม่พบข้อมูลอุปกรณ์ที่ต้องการแก้ไข", 404);
    }

    // Check Duplicate HWID if changing
    if (updateData.hwid && updateData.hwid !== oldDevice.hwid) {
      const existingDevice = await DeviceModel.findByHwid(updateData.hwid);
      if (existingDevice) {
        throw new AppError(
          `HWID '${updateData.hwid}' นี้ถูกลงทะเบียนไปแล้ว`,
          400,
        );
      }
    }

    delete updateData.id;
    delete updateData.company_id;

    await DeviceModel.update(id, companyId, updateData);

    const newDevice = { ...oldDevice, ...updateData };
    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "devices",
        recordId: id,
        oldVal: oldDevice,
        newVal: newDevice,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return newDevice;
  }

  // ==============================================================
  // ลบอุปกรณ์
  async deleteDevice(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldDevice = await DeviceModel.findById(id, companyId);
    if (!oldDevice) {
      throw new AppError("ไม่พบข้อมูลอุปกรณ์", 404);
    }

    await DeviceModel.delete(id, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "DELETE",
        table: "devices",
        recordId: id,
        oldVal: oldDevice,
        newVal: null,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }
}

module.exports = new DeviceService();
