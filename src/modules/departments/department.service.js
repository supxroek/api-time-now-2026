/**
 * /src/modules/departments/department.service.js
 *
 * Departments Service
 * ชั้นบริการสำหรับการจัดการข้อมูลแผนก
 */

// import models and helpers
const pool = require("../../config/database");
const DepartmentModel = require("./department.model");

// Service Class
class DepartmentService {
  // ดึงรายการแผนกทั้งหมดสำหรับบริษัทที่ระบุ
  async getDepartments(companyId) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("กรุณาเข้าสู่ระบบใหม่");
    }
    return await DepartmentModel.findAllByCompanyId(companyId);
  }

  // สร้างแผนกใหม่สำหรับบริษัทที่ระบุ
  async createDepartment(companyId, departmentData) {
    // ตรวจสอบ companyId
    if (!companyId || !departmentData) {
      throw new Error("ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบอีกครั้ง");
    }
    // ตรวจสอบชื่อแผนกไม่ให้ซ้ำกันภายในบริษัท
    const existingDepartments = await DepartmentModel.findAllByCompanyId(
      companyId
    );
    const isDuplicate = existingDepartments.some(
      (dept) => dept.departmentName === departmentData.departmentName
    );
    if (isDuplicate) {
      throw new Error(
        `ชื่อแผนก "${departmentData.departmentName}" มีอยู่ในระบบแล้ว`
      );
    }

    // สร้างแผนกใหม่
    const newDepartment = await DepartmentModel.create(
      companyId,
      departmentData
    );

    // ตรวจสอบว่าสร้างสำเร็จจริงหรือไม่
    const verifiedDepartment = await DepartmentModel.findByIdAndCompanyId(
      newDepartment.id,
      companyId
    );
    if (!verifiedDepartment) {
      throw new Error("เกิดข้อผิดพลาดในการสร้างแผนก กรุณาลองใหม่");
    }

    return newDepartment;
  }

  // ดึงข้อมูลแผนกตาม ID สำหรับบริษัทที่ระบุ
  async getDepartmentById(companyId, departmentId) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("companyId is required");
    }
    return await DepartmentModel.findByIdAndCompanyId(departmentId, companyId);
  }

  // อัปเดตข้อมูลแผนกตาม ID สำหรับบริษัทที่ระบุ
  async updateDepartment(companyId, departmentId, updateData) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("companyId is required");
    }

    // Ensure departmentId is a number for comparison
    const idToUpdate = Number(departmentId);

    // ป้องกันชื่อแผนกซ้ำกันเมื่ออัปเดต
    if (updateData.departmentName) {
      const existingDepartments = await DepartmentModel.findAllByCompanyId(
        companyId
      );
      const isDuplicate = existingDepartments.some(
        (dept) =>
          dept.departmentName === updateData.departmentName &&
          dept.id !== idToUpdate
      );
      if (isDuplicate) {
        throw new Error(
          `ชื่อแผนก "${updateData.departmentName}" มีอยู่ในระบบแล้ว`
        );
      }
    }

    // Remove id from updateData to prevent updating primary key
    const { id, ...dataToUpdate } = updateData;

    // อัปเดตแผนก
    return await DepartmentModel.updateByIdAndCompanyId(
      departmentId,
      companyId,
      dataToUpdate
    );
  }

  // ลบแผนกตาม ID สำหรับบริษัทที่ระบุ
  async deleteDepartment(companyId, departmentId) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("companyId is required");
    }
    // ตรวจสอบว่ามีแผนกดังกล่าวอยู่หรือไม่
    const department = await DepartmentModel.findByIdAndCompanyId(
      departmentId,
      companyId
    );
    if (!department) {
      throw new Error("ไม่พบแผนกที่ต้องการลบ");
    }

    // ลบแผนก
    return await DepartmentModel.deleteByIdAndCompanyId(
      departmentId,
      companyId
    );
  }
}

module.exports = new DepartmentService();
