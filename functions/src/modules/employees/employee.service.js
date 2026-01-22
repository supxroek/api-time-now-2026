const EmployeeModel = require("./employee.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// Employee Service
class EmployeeService {
  // ==============================================================
  // สร้างพนักงานใหม่
  async createEmployee(user, employeeData, ipAddress) {
    // 1. รับค่า user.company_id มาจาก req.user (Multi-tenancy)
    const companyId = user.company_id;
    const dataToCreate = {
      ...employeeData,
      company_id: companyId,
    };

    // 2. เพิ่มข้อมูลในฐานข้อมูล
    const newEmployeeId = await EmployeeModel.create(dataToCreate);

    // 3. Audit Trail - บันทึกการกระทำ
    // action: INSERT, oldVal: null, newVal: dataToCreate
    await auditRecord({
      userId: user.id, // userId
      companyId: companyId, // companyId
      action: "INSERT", // การกระทำ
      table: "employees", // ตาราง
      recordId: newEmployeeId, // recordId
      oldVal: null, // ค่าเดิม
      newVal: dataToCreate, // ค่าใหม่
      ipAddress: ipAddress, // IP Address
    });

    return { id: newEmployeeId, ...dataToCreate };
  }

  // ==============================================================
  // ดึงข้อมูลพนักงานทั้งหมด
  async getAllEmployees(companyId, query) {
    // 1. จัดการกับ Pagination และ Filters
    const { page = 1, limit = 20, search, status, department_id } = query;
    const offset = (page - 1) * limit;

    const filters = { search, status, department_id };

    // 2. ดึงข้อมูลจากฐานข้อมูล
    const employees = await EmployeeModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    // 3. นับจำนวนทั้งหมด (สำหรับ Pagination)
    const total = await EmployeeModel.countAll(companyId, filters);

    // 4. คืนค่าผลลัพธ์พร้อมข้อมูล Pagination
    return {
      employees,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // ดึงข้อมูลพนักงานคนเดียวตาม ID
  async getEmployeeById(companyId, id) {
    const employee = await EmployeeModel.findById(id, companyId);
    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404);
    }
    return employee;
  }

  // ==============================================================
  // อัปเดตข้อมูลพนักงาน
  async updateEmployee(user, id, updateData, ipAddress) {
    const companyId = user.company_id;

    // 1. ดึงข้อมูลเดิม
    const oldEmployee = await EmployeeModel.findById(id, companyId);
    if (!oldEmployee) {
      throw new AppError("ไม่พบข้อมูลพนักงานที่ต้องการแก้ไข", 404);
    }

    // 2. อัปเดตข้อมูล
    await EmployeeModel.update(id, companyId, updateData);

    // 3. ดึงข้อมูลใหม่ (สำหรับการบันทึกที่ถูกต้อง หรือสร้างขึ้นใหม่)
    const newEmployee = { ...oldEmployee, ...updateData };

    // 4. Audit Trail - บันทึกการกระทำ
    // action: UPDATE, oldVal: oldEmployee, newVal: newEmployee
    await auditRecord({
      userId: user.id,
      companyId: companyId,
      action: "UPDATE",
      table: "employees",
      recordId: id,
      oldVal: oldEmployee,
      newVal: newEmployee,
      ipAddress: ipAddress,
    });

    return newEmployee;
  }

  // ==============================================================
  // ลบพนักงาน (Soft Delete)
  async deleteEmployee(user, id, ipAddress) {
    const companyId = user.company_id;

    // 1. ดึงข้อมูลเดิม
    const oldEmployee = await EmployeeModel.findById(id, companyId);
    if (!oldEmployee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404);
    }

    // 2. ลบแบบ Soft Delete
    await EmployeeModel.softDelete(id, companyId);

    // 3. Audit Trail (บันทึกเป็น DELETE แต่เป็นการลบแบบเชิงตรรกะ)
    // สำหรับการลบแบบนุ่มนวล (soft delete) เราสามารถพิจารณาว่าเป็น UPDATE (เปลี่ยนสถานะ deleted_at) หรือ DELETE.
    // คำแนะนำผู้ใช้บอกว่า "ใช้การลบแบบนุ่มนวล..." บันทึกการตรวจสอบมักจะบันทึกการดำเนินการ DELETE เพื่อความสอดคล้องของ "การลบ".
    // มาเขียนบันทึกเป็น DELETE แต่เก็บค่า oldValues ไว้
    await auditRecord({
      userId: user.id,
      companyId: companyId,
      action: "DELETE",
      table: "employees",
      recordId: id,
      oldVal: oldEmployee,
      newVal: { deleted_at: new Date() }, // อัปเดทค่าใหม่ในคอลัมน์ deleted_at แสดงว่าถูกลบ (soft delete)
      ipAddress: ipAddress,
    });
  }
}

module.exports = new EmployeeService();
