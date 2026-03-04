const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const CompanyModel = require("./company.model");

class CompanyService {
  static ALLOWED_UPDATE_FIELDS = new Set([
    "name",
    "tax_id",
    "email",
    "phone_number",
    "contact_person",
    "address_detail",
    "sub_district",
    "district",
    "province",
    "postal_code",
    "hr_employee_id",
    "report_date",
    "employee_limit",
  ]);

  filterAllowedFields(payload) {
    const filtered = {};

    Object.keys(payload || {}).forEach((key) => {
      if (CompanyService.ALLOWED_UPDATE_FIELDS.has(key)) {
        filtered[key] = payload[key];
      }
    });

    return filtered;
  }

  validateUpdateData(data) {
    if (
      data.report_date !== undefined &&
      (data.report_date < 1 || data.report_date > 31)
    ) {
      throw new AppError("report_date ต้องอยู่ในช่วง 1 ถึง 31", 400);
    }

    if (
      data.employee_limit !== undefined &&
      data.employee_limit !== null &&
      data.employee_limit < 1
    ) {
      throw new AppError("employee_limit ต้องมากกว่าหรือเท่ากับ 1", 400);
    }
  }

  async getCompanyProfile(companyId) {
    const company = await CompanyModel.findProfileByCompanyId(companyId);
    if (!company) {
      throw new AppError("ไม่พบบริษัท", 404);
    }

    return company;
  }

  normalizeOverviewLimit(value, fallback, max) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.min(Math.floor(parsed), max);
  }

  mapDepartmentRow(row) {
    return {
      id: row.id,
      company_id: row.company_id,
      department_name: row.department_name,
      head_employee_id: row.head_employee_id,
      head_employee: row.head_employee_id
        ? {
            id: row.head_employee_id,
            name: row.head_employee_name,
            employee_code: row.head_employee_code,
          }
        : null,
      employee_count: Number(row.employee_count || 0),
    };
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
      is_active: Number(row.is_active || 0),
      last_sync: row.last_sync,
      access_control_count: Number(row.access_control_count || 0),
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
    const employeeLimit = this.normalizeOverviewLimit(
      query.employee_limit,
      1000,
      3000,
    );
    const departmentLimit = this.normalizeOverviewLimit(
      query.department_limit,
      500,
      1000,
    );
    const deviceLimit = this.normalizeOverviewLimit(
      query.device_limit,
      500,
      1000,
    );
    const targetDate = String(
      query.date || new Date().toISOString().slice(0, 10),
    );

    const [company, departmentsRaw, devicesRaw, employeesRaw, deviceStats] =
      await Promise.all([
        this.getCompanyProfile(companyId),
        CompanyModel.listDepartmentsForOverview(companyId, departmentLimit),
        CompanyModel.listDevicesForOverview(companyId, deviceLimit),
        CompanyModel.listEmployeesForOverview(companyId, employeeLimit),
        CompanyModel.getDeviceUsageStats(companyId, targetDate),
      ]);

    const departments = departmentsRaw.map((row) => this.mapDepartmentRow(row));
    const devices = devicesRaw.map((row) => this.mapDeviceRow(row));
    const employees = employeesRaw.map((row) => this.mapEmployeeRow(row));

    return {
      company,
      departments: {
        total: departments.length,
        items: departments,
      },
      devices: {
        total: devices.length,
        items: devices,
        stats: {
          total: Number(deviceStats.total_devices || 0),
          online: Number(deviceStats.online_devices || 0),
          offline: Number(deviceStats.offline_devices || 0),
          assigned: Number(deviceStats.assigned_devices || 0),
          today: Number(deviceStats.today_logs || 0),
          success: Number(deviceStats.success_logs || 0),
          failed: Number(deviceStats.failed_logs || 0),
        },
      },
      employees: {
        total: employees.length,
        items: employees,
      },
      generated_at: new Date().toISOString(),
    };
  }

  async updateCompanyProfile(user, payload, ipAddress) {
    const companyId = user.company_id;
    const oldCompany = await CompanyModel.findProfileByCompanyId(companyId);

    if (!oldCompany) {
      throw new AppError("ไม่พบบริษัท", 404);
    }

    const cleanData = this.filterAllowedFields(payload);
    this.validateUpdateData(cleanData);

    if (!Object.keys(cleanData).length) {
      return oldCompany;
    }

    await CompanyModel.updateProfileByCompanyId(companyId, cleanData);
    const updatedCompany = await CompanyModel.findProfileByCompanyId(companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "companies",
        recordId: companyId,
        oldVal: oldCompany,
        newVal: updatedCompany,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 companies):", error);
    }

    return updatedCompany;
  }
}

module.exports = new CompanyService();
