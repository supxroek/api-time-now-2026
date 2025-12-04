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
      throw new Error("companyId is required");
    }
    console.log("companyId in service:", companyId);
    return await DepartmentModel.findAllByCompanyId(companyId);
  }

  // สร้างแผนกใหม่สำหรับบริษัทที่ระบุ
  async createDepartment(companyId, departmentData) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบ companyId
      if (!companyId || !departmentData) {
        throw new Error("companyId and departmentData are required");
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
          `Department name:${departmentData.departmentName} already exists within the company`
        );
      }

      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      // สร้างแผนกใหม่
      return await DepartmentModel.create(companyId, departmentData);
    } catch (error) {
      // rollback transaction - กรณีล้มเหลว: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
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
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบ companyId
      if (!companyId) {
        throw new Error("companyId is required");
      }
      // ป้องกันชื่อแผนกซ้ำกันเมื่ออัปเดต
      const existingDepartments = await DepartmentModel.findAllByCompanyId(
        companyId
      );
      const isDuplicate = existingDepartments.some(
        (dept) =>
          dept.departmentName === updateData.departmentName &&
          dept.id !== departmentId
      );
      if (isDuplicate) {
        throw new Error(
          `Department name:${updateData.departmentName} already exists within the company`
        );
      }

      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      // อัปเดตแผนก
      return await DepartmentModel.updateByIdAndCompanyId(
        departmentId,
        companyId,
        updateData
      );
    } catch (error) {
      // rollback transaction - กรณีล้มเหลว: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  // ลบแผนกตาม ID สำหรับบริษัทที่ระบุ
  async deleteDepartment(companyId, departmentId) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
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
        throw new Error("Department not found");
      }

      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      // ลบแผนก
      return await DepartmentModel.deleteByIdAndCompanyId(
        departmentId,
        companyId
      );
    } catch (error) {
      // rollback transaction - กรณีล้มเหลว: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }
}

module.exports = new DepartmentService();
