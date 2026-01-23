const DepartmentModel = require("./department.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// Department Service
class DepartmentService {
  // ==============================================================
  // สร้างแผนกใหม่
  async createDepartment(user, departmentData, ipAddress) {
    const companyId = user.company_id;
    const { company_id, ...cleanData } = departmentData;

    const dataToCreate = {
      ...cleanData,
      company_id: companyId,
    };

    // Check duplicate department_name
    if (cleanData.department_name) {
      const existingDept = await DepartmentModel.findByName(
        cleanData.department_name,
        companyId,
      );
      if (existingDept) {
        throw new AppError(
          `ชื่อแผนก '${cleanData.department_name}' นี้มีอยู่ในระบบแล้ว`,
          400,
        );
      }
    }

    const newDeptId = await DepartmentModel.create(dataToCreate);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "INSERT",
        table: "departments",
        recordId: newDeptId,
        oldVal: null,
        newVal: dataToCreate,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return { id: newDeptId, ...dataToCreate };
  }

  // ==============================================================
  // ดึงข้อมูลแผนกทั้งหมด
  async getAllDepartments(companyId, query) {
    const { page = 1, limit = 20, search, branch_id } = query;
    const offset = (page - 1) * limit;

    const filters = { search, branch_id };

    const departments = await DepartmentModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await DepartmentModel.countAll(companyId, filters);

    return {
      departments,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // ดึงข้อมูลแผนกคนเดียวตาม ID
  async getDepartmentById(companyId, id) {
    const department = await DepartmentModel.findById(id, companyId);
    if (!department) {
      throw new AppError("ไม่พบข้อมูลแผนก", 404);
    }
    return department;
  }

  // ==============================================================
  // อัปเดตข้อมูลแผนก
  async updateDepartment(user, id, updateData, ipAddress) {
    const companyId = user.company_id;

    const oldDept = await DepartmentModel.findById(id, companyId);
    if (!oldDept) {
      throw new AppError("ไม่พบข้อมูลแผนกที่ต้องการแก้ไข", 404);
    }

    // Check Duplicate department_name if changing
    if (
      updateData.department_name &&
      updateData.department_name !== oldDept.department_name
    ) {
      const existingDept = await DepartmentModel.findByName(
        updateData.department_name,
        companyId,
      );
      if (existingDept) {
        throw new AppError(
          `ชื่อแผนก '${updateData.department_name}' นี้มีอยู่ในระบบแล้ว`,
          400,
        );
      }
    }

    delete updateData.id;
    delete updateData.company_id;

    await DepartmentModel.update(id, companyId, updateData);

    const newDept = { ...oldDept, ...updateData };
    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "departments",
        recordId: id,
        oldVal: oldDept,
        newVal: newDept,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return newDept;
  }

  // ==============================================================
  // ลบแผนก
  async deleteDepartment(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldDept = await DepartmentModel.findById(id, companyId);
    if (!oldDept) {
      throw new AppError("ไม่พบข้อมูลแผนก", 404);
    }

    // ตรวจสอบว่ามีพนักงานสังกัดแผนกนี้หรือไม่
    // หากมี ให้แจ้งข้อผิดพลาด ไม่อนุญาตให้ลบ
    // และหากไม่มี จึงลบแผนกได้
    try {
      await DepartmentModel.delete(id, companyId);
    } catch (err) {
      if (err.code === "ER_ROW_IS_REFERENCED_2") {
        throw new AppError(
          "ไม่สามารถลบแผนกนี้ได้เนื่องจากยังมีพนักงานสังกัดอยู่",
          400,
        );
      }
      throw err;
    }

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "DELETE",
        table: "departments",
        recordId: id,
        oldVal: oldDept,
        newVal: null,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }
}

module.exports = new DepartmentService();
