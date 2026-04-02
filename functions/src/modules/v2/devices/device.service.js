const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const StatsService = require("../stats/stats.service");
const DeviceModel = require("./device.model");

class DeviceService {
  static ALLOWED_DEVICE_FIELDS = new Set([
    "name",
    "location_name",
    "description",
    "hwid",
    "passcode",
    "is_active",
  ]);

  filterAllowedDeviceFields(payload) {
    const filtered = {};
    Object.keys(payload || {}).forEach((key) => {
      if (DeviceService.ALLOWED_DEVICE_FIELDS.has(key)) {
        filtered[key] = payload[key];
      }
    });

    return filtered;
  }

  normalizeOverviewLimit(value, fallback, max) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.min(Math.floor(parsed), max);
  }

  mapDeviceRow(row) {
    return {
      id: row.id,
      company_id: row.company_id,
      name: row.name,
      location_name: row.location_name,
      description: row.description,
      hwid: row.hwid,
      passcode: row.passcode,
      is_active: Number(row.is_active || 0) === 1,
      deleted_at: row.deleted_at,
      access_control_count: Number(row.access_control_count || 0),
    };
  }

  mapDepartmentRow(row) {
    return {
      id: row.id,
      company_id: row.company_id,
      department_name: row.department_name,
      head_employee_id: row.head_employee_id,
    };
  }

  mapEmployeeRow(row) {
    return {
      id: row.id,
      company_id: row.company_id,
      employee_code: row.employee_code,
      department_id: row.department_id,
      department_name: row.department_name,
      name: row.name,
      email: row.email,
      image_url: row.image_url,
      phone_number: row.phone_number,
      status: row.status,
      start_date: row.start_date,
      resign_date: row.resign_date,
    };
  }

  async getOverview(companyId, query = {}) {
    const deviceLimit = this.normalizeOverviewLimit(
      query.device_limit,
      500,
      1000,
    );
    const departmentLimit = this.normalizeOverviewLimit(
      query.department_limit,
      500,
      1000,
    );
    const employeeLimit = this.normalizeOverviewLimit(
      query.employee_limit,
      2000,
      3000,
    );
    const targetDate = String(
      query.date || new Date().toISOString().slice(0, 10),
    );

    const [statsOverview, devicesRaw, departmentsRaw, employeesRaw, activity] =
      await Promise.all([
        StatsService.getOverview(companyId),
        DeviceModel.listDevicesForOverview(companyId, deviceLimit),
        DeviceModel.listDepartmentsForOverview(companyId, departmentLimit),
        DeviceModel.listEmployeesForOverview(companyId, employeeLimit),
        DeviceModel.getTodayDeviceActivity(companyId, targetDate),
      ]);

    const devices = devicesRaw.map((row) => this.mapDeviceRow(row));
    const departments = departmentsRaw.map((row) => this.mapDepartmentRow(row));
    const employees = employeesRaw.map((row) => this.mapEmployeeRow(row));

    return {
      contract_version: "v2.devices.overview.2026-03-11",
      stats: statsOverview?.devices || {},
      device_activity: activity,
      devices: {
        total: devices.length,
        items: devices,
      },
      departments: {
        total: departments.length,
        items: departments,
      },
      employees: {
        total: employees.length,
        items: employees,
      },
      generated_at: new Date().toISOString(),
    };
  }

  async getAllDevices(companyId, query) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;
    const filters = {
      search: query.search?.trim() || "",
      is_active: query.is_active,
    };

    const devices = await DeviceModel.findAllByCompanyId(
      companyId,
      filters,
      limit,
      offset,
    );
    const total = await DeviceModel.countAllByCompanyId(companyId, filters);

    return {
      devices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDeviceById(companyId, deviceId) {
    const device = await DeviceModel.findByIdAndCompanyId(deviceId, companyId);
    if (!device) {
      throw new AppError("ไม่พบข้อมูลอุปกรณ์", 404);
    }

    return device;
  }

  async createDevice(user, payload, ipAddress) {
    const companyId = user.company_id;
    const cleanData = this.filterAllowedDeviceFields(payload);

    if (!cleanData.name?.trim() || !cleanData.hwid?.trim()) {
      throw new AppError("กรุณาระบุชื่ออุปกรณ์และ HWID", 400);
    }

    const duplicate = await DeviceModel.findByHwid(cleanData.hwid.trim());
    if (duplicate) {
      throw new AppError(
        `HWID '${cleanData.hwid.trim()}' นี้ถูกใช้งานแล้ว`,
        400,
      );
    }

    const dataToCreate = {
      company_id: companyId,
      name: cleanData.name.trim(),
      location_name: cleanData.location_name || null,
      description: cleanData.description || null,
      hwid: cleanData.hwid.trim(),
      passcode: cleanData.passcode || null,
      is_active:
        cleanData.is_active === undefined ? 1 : Number(cleanData.is_active),
    };

    const newId = await DeviceModel.create(dataToCreate);
    const created = await DeviceModel.findByIdAndCompanyId(newId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "INSERT",
        table: "devices",
        recordId: newId,
        oldVal: null,
        newVal: created,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 devices create):", error);
    }

    return created;
  }

  async updateDevice(user, deviceId, payload, ipAddress) {
    const companyId = user.company_id;
    const oldDevice = await DeviceModel.findByIdAndCompanyId(
      deviceId,
      companyId,
    );

    if (!oldDevice) {
      throw new AppError("ไม่พบข้อมูลอุปกรณ์ที่ต้องการแก้ไข", 404);
    }

    const cleanData = this.filterAllowedDeviceFields(payload);

    if (cleanData.name !== undefined && !cleanData.name?.trim()) {
      throw new AppError("กรุณาระบุชื่ออุปกรณ์", 400);
    }

    if (cleanData.hwid !== undefined) {
      if (!cleanData.hwid?.trim()) {
        throw new AppError("กรุณาระบุ HWID", 400);
      }

      const duplicate = await DeviceModel.findByHwid(
        cleanData.hwid.trim(),
        Number(deviceId),
      );
      if (duplicate) {
        throw new AppError(
          `HWID '${cleanData.hwid.trim()}' นี้ถูกใช้งานแล้ว`,
          400,
        );
      }

      cleanData.hwid = cleanData.hwid.trim();
    }

    if (cleanData.name !== undefined) {
      cleanData.name = cleanData.name.trim();
    }

    if (cleanData.is_active !== undefined) {
      const activeFlag = Number(cleanData.is_active);
      if (![0, 1].includes(activeFlag)) {
        throw new AppError("is_active ต้องเป็น 0 หรือ 1", 400);
      }
      cleanData.is_active = activeFlag;
    }

    await DeviceModel.updateByIdAndCompanyId(deviceId, companyId, cleanData);
    const updated = await DeviceModel.findByIdAndCompanyId(deviceId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "devices",
        recordId: Number(deviceId),
        oldVal: oldDevice,
        newVal: updated,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 devices update):", error);
    }

    return updated;
  }

  async deleteDevice(user, deviceId, ipAddress) {
    const companyId = user.company_id;
    const oldDevice = await DeviceModel.findByIdAndCompanyId(
      deviceId,
      companyId,
    );

    if (!oldDevice) {
      throw new AppError("ไม่พบข้อมูลอุปกรณ์", 404);
    }

    await DeviceModel.softDeleteByIdAndCompanyId(deviceId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "DELETE",
        table: "devices",
        recordId: Number(deviceId),
        oldVal: oldDevice,
        newVal: { ...oldDevice, deleted_at: new Date(), is_active: 0 },
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 devices delete):", error);
    }
  }

  async getAccessControls(user, deviceId) {
    const companyId = user.company_id;
    const device = await DeviceModel.findByIdAndCompanyId(deviceId, companyId);
    if (!device) {
      throw new AppError("ไม่พบอุปกรณ์", 404);
    }

    const controls = await DeviceModel.getAccessControlsByDeviceId(deviceId);
    return {
      device,
      controls,
    };
  }

  async addAccessControl(user, deviceId, payload, ipAddress) {
    const companyId = user.company_id;
    const device = await DeviceModel.findByIdAndCompanyId(deviceId, companyId);
    if (!device) {
      throw new AppError("ไม่พบอุปกรณ์", 404);
    }

    const { target_type, target_id } = payload;
    if (!["employee", "department", "all"].includes(target_type)) {
      throw new AppError(
        "target_type ต้องเป็น employee, department หรือ all",
        400,
      );
    }

    let normalizedTargetId = target_id ?? null;
    if (target_type === "all") {
      normalizedTargetId = null;
    }

    if (target_type === "employee") {
      if (!normalizedTargetId) {
        throw new AppError("กรุณาระบุ target_id ของ employee", 400);
      }
      const exists = await DeviceModel.existsEmployeeInCompany(
        normalizedTargetId,
        companyId,
      );
      if (!exists) {
        throw new AppError("ไม่พบ employee ในบริษัทนี้", 404);
      }
    }

    if (target_type === "department") {
      if (!normalizedTargetId) {
        throw new AppError("กรุณาระบุ target_id ของ department", 400);
      }
      const exists = await DeviceModel.existsDepartmentInCompany(
        normalizedTargetId,
        companyId,
      );
      if (!exists) {
        throw new AppError("ไม่พบ department ในบริษัทนี้", 404);
      }
    }

    const existing = await DeviceModel.findAccessControl(
      deviceId,
      target_type,
      normalizedTargetId,
    );

    if (existing) {
      return existing;
    }

    const newId = await DeviceModel.createAccessControl(
      deviceId,
      target_type,
      normalizedTargetId,
    );

    const created = {
      id: newId,
      device_id: Number(deviceId),
      target_type,
      target_id: normalizedTargetId,
    };

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "INSERT",
        table: "device_access_controls",
        recordId: newId,
        oldVal: null,
        newVal: created,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 access control create):", error);
    }

    return created;
  }

  async removeAccessControl(user, deviceId, payload, ipAddress) {
    const companyId = user.company_id;
    const device = await DeviceModel.findByIdAndCompanyId(deviceId, companyId);
    if (!device) {
      throw new AppError("ไม่พบอุปกรณ์", 404);
    }

    const { target_type, target_id } = payload;
    if (!["employee", "department", "all"].includes(target_type)) {
      throw new AppError(
        "target_type ต้องเป็น employee, department หรือ all",
        400,
      );
    }

    const normalizedTargetId =
      target_type === "all" ? null : (target_id ?? null);

    const existing = await DeviceModel.findAccessControl(
      deviceId,
      target_type,
      normalizedTargetId,
    );
    if (!existing) {
      throw new AppError("ไม่พบสิทธิ์ที่ต้องการลบ", 404);
    }

    await DeviceModel.deleteAccessControl(existing.id, deviceId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "DELETE",
        table: "device_access_controls",
        recordId: existing.id,
        oldVal: existing,
        newVal: null,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 access control delete):", error);
    }
  }
}

module.exports = new DeviceService();
