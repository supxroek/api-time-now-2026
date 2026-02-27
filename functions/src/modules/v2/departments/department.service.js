const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const DepartmentModel = require("./department.model");

class DepartmentService {
  static ALLOWED_FIELDS = new Set(["department_name", "head_employee_id"]);

  filterAllowedFields(payload) {
    const filtered = {};

    Object.keys(payload || {}).forEach((key) => {
      if (DepartmentService.ALLOWED_FIELDS.has(key)) {
        filtered[key] = payload[key];
      }
    });

    return filtered;
  }

  async validateHeadEmployee(companyId, headEmployeeId) {
    if (headEmployeeId === undefined || headEmployeeId === null) {
      return;
    }

    const exists = await DepartmentModel.existsEmployeeInCompany(
      headEmployeeId,
      companyId,
    );
    if (!exists) {
      throw new AppError("head_employee_id ไม่ถูกต้องสำหรับบริษัทนี้", 400);
    }
  }

  async createDepartment(user, payload, ipAddress) {
    const companyId = user.company_id;
    const cleanData = this.filterAllowedFields(payload);

    if (!cleanData.department_name?.trim()) {
      throw new AppError("กรุณาระบุชื่อแผนก", 400);
    }

    const duplicate = await DepartmentModel.findByNameAndCompanyId(
      cleanData.department_name.trim(),
      companyId,
    );
    if (duplicate) {
      throw new AppError("ชื่อแผนกนี้มีอยู่แล้ว", 400);
    }

    await this.validateHeadEmployee(companyId, cleanData.head_employee_id);

    const dataToCreate = {
      company_id: companyId,
      department_name: cleanData.department_name.trim(),
      head_employee_id:
        cleanData.head_employee_id === undefined
          ? null
          : cleanData.head_employee_id,
    };

    const newId = await DepartmentModel.create(dataToCreate);
    const created = await DepartmentModel.findByIdAndCompanyId(
      newId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "INSERT",
        table: "departments",
        recordId: newId,
        oldVal: null,
        newVal: created,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 departments create):", error);
    }

    return created;
  }

  async getAllDepartments(companyId, query) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;
    const search = query.search?.trim() || "";

    const departments = await DepartmentModel.findAllByCompanyId(
      companyId,
      limit,
      offset,
      search,
    );
    const total = await DepartmentModel.countAllByCompanyId(companyId, search);

    return {
      departments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDepartmentById(companyId, departmentId) {
    const department = await DepartmentModel.findByIdAndCompanyId(
      departmentId,
      companyId,
    );

    if (!department) {
      throw new AppError("ไม่พบข้อมูลแผนก", 404);
    }

    return department;
  }

  async updateDepartment(user, departmentId, payload, ipAddress) {
    const companyId = user.company_id;
    const oldData = await DepartmentModel.findByIdAndCompanyId(
      departmentId,
      companyId,
    );

    if (!oldData) {
      throw new AppError("ไม่พบข้อมูลแผนกที่ต้องการแก้ไข", 404);
    }

    const cleanData = this.filterAllowedFields(payload);

    if (
      cleanData.department_name !== undefined &&
      !cleanData.department_name.trim()
    ) {
      throw new AppError("กรุณาระบุชื่อแผนก", 400);
    }

    if (
      cleanData.department_name &&
      cleanData.department_name.trim() !== oldData.department_name
    ) {
      const duplicate = await DepartmentModel.findByNameAndCompanyId(
        cleanData.department_name.trim(),
        companyId,
      );
      if (duplicate && duplicate.id !== Number(departmentId)) {
        throw new AppError("ชื่อแผนกนี้มีอยู่แล้ว", 400);
      }
    }

    await this.validateHeadEmployee(companyId, cleanData.head_employee_id);

    if (cleanData.department_name !== undefined) {
      cleanData.department_name = cleanData.department_name.trim();
    }

    await DepartmentModel.updateByIdAndCompanyId(
      departmentId,
      companyId,
      cleanData,
    );
    const updated = await DepartmentModel.findByIdAndCompanyId(
      departmentId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "departments",
        recordId: Number(departmentId),
        oldVal: oldData,
        newVal: updated,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 departments update):", error);
    }

    return updated;
  }

  async deleteDepartment(user, departmentId, ipAddress) {
    const companyId = user.company_id;
    const oldData = await DepartmentModel.findByIdAndCompanyId(
      departmentId,
      companyId,
    );

    if (!oldData) {
      throw new AppError("ไม่พบข้อมูลแผนก", 404);
    }

    await DepartmentModel.deleteByIdAndCompanyId(departmentId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "DELETE",
        table: "departments",
        recordId: Number(departmentId),
        oldVal: oldData,
        newVal: null,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 departments delete):", error);
    }
  }
}

module.exports = new DepartmentService();
