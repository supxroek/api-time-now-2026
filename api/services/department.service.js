/**
 * /api/services/department.service.js
 *
 * Department Service - Business Logic Layer
 * จัดการ logic ที่เกี่ยวกับแผนก
 */

const Department = require("../models/department.model");

class DepartmentService {
  /**
   * ดึงรายชื่อแผนกทั้งหมดพร้อมจำนวนพนักงาน
   * @param {number} companyId
   * @returns {Promise<Array>}
   */
  async getAllWithEmployeeCount(companyId) {
    return Department.findWithEmployeeCount(companyId);
  }

  /**
   * ดึงข้อมูลแผนกพร้อมรายละเอียด
   * @param {number} companyId
   * @param {number} departmentId
   * @returns {Promise<Object>}
   */
  async getById(companyId, departmentId) {
    const department = await Department.findWithManager(departmentId);

    if (!department) {
      const error = new Error("Department not found");
      error.statusCode = 404;
      throw error;
    }

    // ตรวจสอบว่าแผนกเป็นของบริษัทนี้
    if (department.companyId !== companyId) {
      const error = new Error("Department not found");
      error.statusCode = 404;
      throw error;
    }

    return department;
  }

  /**
   * สร้างแผนกใหม่
   * @param {number} companyId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(companyId, data) {
    // ตรวจสอบว่าชื่อแผนกซ้ำหรือไม่
    if (data.departmentName) {
      const exists = await Department.isNameExists(
        companyId,
        data.departmentName
      );
      if (exists) {
        const error = new Error("Department name already exists");
        error.statusCode = 400;
        throw error;
      }
    }

    // สร้างแผนกใหม่
    const department = await Department.create({
      ...data,
      companyId: companyId,
    });

    return department;
  }

  /**
   * อัพเดทแผนก
   * @param {number} companyId
   * @param {number} departmentId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async update(companyId, departmentId, data) {
    // ตรวจสอบว่าแผนกมีอยู่และเป็นของบริษัทนี้
    const department = await Department.findById(departmentId);
    if (!department || department.companyId !== companyId) {
      const error = new Error("Department not found");
      error.statusCode = 404;
      throw error;
    }

    // ตรวจสอบว่าชื่อแผนกซ้ำหรือไม่ (ถ้ามีการเปลี่ยน)
    if (data.departmentName) {
      const exists = await Department.isNameExists(
        companyId,
        data.departmentName,
        departmentId
      );
      if (exists) {
        const error = new Error("Department name already exists");
        error.statusCode = 400;
        throw error;
      }
    }

    // อัพเดทแผนก
    const updated = await Department.update(departmentId, data);

    return updated;
  }

  /**
   * ลบแผนก
   * @param {number} companyId
   * @param {number} departmentId
   * @param {Object} options - { force: boolean, transferTo: number }
   * @returns {Promise<Object>}
   */
  async delete(companyId, departmentId, options = {}) {
    const { force = false, transferTo = null } = options;

    // ตรวจสอบว่าแผนกมีอยู่และเป็นของบริษัทนี้
    const department = await Department.findById(departmentId);
    if (!department || department.companyId !== companyId) {
      const error = new Error("Department not found");
      error.statusCode = 404;
      throw error;
    }

    // ตรวจสอบจำนวนพนักงานในแผนก
    const employeeCount = await Department.countEmployees(departmentId);

    if (employeeCount > 0) {
      if (!force && !transferTo) {
        const error = new Error(
          `Cannot delete department with ${employeeCount} employees. ` +
            `Use 'force=true' to delete anyway or provide 'transferTo' department ID.`
        );
        error.statusCode = 400;
        error.employeeCount = employeeCount;
        throw error;
      }

      // ย้ายพนักงานไปแผนกอื่น
      if (transferTo) {
        // ตรวจสอบว่าแผนกปลายทางมีอยู่
        const targetDept = await Department.findById(transferTo);
        if (!targetDept || targetDept.companyId !== companyId) {
          const error = new Error("Transfer target department not found");
          error.statusCode = 400;
          throw error;
        }

        await Department.transferAllEmployees(departmentId, transferTo);
      }
    }

    // ลบแผนก
    const deleted = await Department.delete(departmentId);

    return {
      success: deleted,
      message: deleted
        ? "Department deleted successfully"
        : "Failed to delete department",
      employeesTransferred: transferTo ? employeeCount : 0,
    };
  }
}

module.exports = new DepartmentService();
