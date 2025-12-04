/**
 * /src/modules/organization/org.service.js
 *
 * Organization Service
 * ชั้นบริการสำหรับการจัดการข้อมูลองค์กร
 */

// import models and helpers
const DepartmentModel = require("./department.model");

// Service Class
class DepartmentService {
  // ดึงรายการแผนกทั้งหมดสำหรับบริษัทที่ระบุ
  async getDepartments(companyId) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("companyId is required");
    }
    console.log("companyId in service:", companyId);
    return await DepartmentModel.findAllByCompanyId(companyId);
  }

  // สร้างแผนกใหม่สำหรับบริษัทที่ระบุ
  async createDepartment(companyId, departmentData) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("companyId is required");
    }
    return await DepartmentModel.create(companyId, departmentData);
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
    return await DepartmentModel.updateByIdAndCompanyId(
      departmentId,
      companyId,
      updateData
    );
  }

  // ลบแผนกตาม ID สำหรับบริษัทที่ระบุ
  async deleteDepartment(companyId, departmentId) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("companyId is required");
    }
    return await DepartmentModel.deleteByIdAndCompanyId(
      departmentId,
      companyId
    );
  }
}

module.exports = new DepartmentService();
