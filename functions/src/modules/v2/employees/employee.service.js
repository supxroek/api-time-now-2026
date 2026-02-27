const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const EmployeeModel = require("./employee.model");

class EmployeeService {
  static ALLOWED_UPDATE_FIELDS = new Set([
    "employee_code",
    "department_id",
    "name",
    "email",
    "image_url",
    "phone_number",
    "id_or_passport_number",
    "line_user_id",
    "start_date",
    "resign_date",
    "status",
  ]);

  filterAllowedFields(payload) {
    const filtered = {};

    Object.keys(payload || {}).forEach((key) => {
      if (EmployeeService.ALLOWED_UPDATE_FIELDS.has(key)) {
        filtered[key] = payload[key];
      }
    });

    return filtered;
  }

  async ensureUniqueFields(companyId, data, excludeEmployeeId = null) {
    const duplicate = await EmployeeModel.findDuplicateUniqueFields(
      companyId,
      data,
      excludeEmployeeId,
    );

    if (!duplicate) {
      return;
    }

    const map = {
      email: "อีเมล",
      id_or_passport_number: "เลขบัตรประชาชน/หนังสือเดินทาง",
      line_user_id: "Line User ID",
      employee_code: "รหัสพนักงาน",
    };

    const duplicateKey = Object.keys(map).find(
      (key) =>
        data[key] !== undefined &&
        data[key] !== null &&
        data[key] !== "" &&
        duplicate[key] === data[key],
    );

    if (duplicateKey) {
      throw new AppError(
        `${map[duplicateKey]} '${data[duplicateKey]}' นี้มีอยู่ในระบบแล้ว`,
        400,
      );
    }

    throw new AppError("ข้อมูลซ้ำในระบบ", 400);
  }

  async getAllEmployees(companyId, query) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;
    const filters = {
      search: query.search?.trim(),
      status: query.status,
      department_id: query.department_id,
    };

    const employees = await EmployeeModel.findAllByCompanyId(
      companyId,
      filters,
      limit,
      offset,
    );
    const total = await EmployeeModel.countAllByCompanyId(companyId, filters);

    return {
      employees,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEmployeeById(companyId, employeeId) {
    const employee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );
    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404);
    }

    return employee;
  }

  async updateEmployee(user, employeeId, payload, ipAddress) {
    const companyId = user.company_id;
    const oldEmployee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );

    if (!oldEmployee) {
      throw new AppError("ไม่พบข้อมูลพนักงานที่ต้องการแก้ไข", 404);
    }

    const cleanData = this.filterAllowedFields(payload);

    if (cleanData.name !== undefined && !cleanData.name?.trim()) {
      throw new AppError("กรุณาระบุชื่อพนักงาน", 400);
    }
    if (cleanData.email !== undefined && !cleanData.email?.trim()) {
      throw new AppError("กรุณาระบุอีเมลพนักงาน", 400);
    }
    if (
      cleanData.status &&
      !["active", "resigned", "suspended"].includes(cleanData.status)
    ) {
      throw new AppError("status ไม่ถูกต้อง", 400);
    }

    if (cleanData.name !== undefined) cleanData.name = cleanData.name.trim();
    if (cleanData.email !== undefined) cleanData.email = cleanData.email.trim();

    await this.ensureUniqueFields(companyId, cleanData, Number(employeeId));

    await EmployeeModel.updateByIdAndCompanyId(
      employeeId,
      companyId,
      cleanData,
    );
    const updatedEmployee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "employees",
        recordId: Number(employeeId),
        oldVal: oldEmployee,
        newVal: updatedEmployee,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 employees update):", error);
    }

    return updatedEmployee;
  }

  async deleteEmployee(user, employeeId, ipAddress) {
    const companyId = user.company_id;
    const oldEmployee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );

    if (!oldEmployee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404);
    }

    await EmployeeModel.softDeleteByIdAndCompanyId(employeeId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "DELETE",
        table: "employees",
        recordId: Number(employeeId),
        oldVal: oldEmployee,
        newVal: { ...oldEmployee, deleted_at: new Date() },
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 employees delete):", error);
    }
  }
}

module.exports = new EmployeeService();
