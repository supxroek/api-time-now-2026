/**
 * /src/modules/shifts/shifts.service.js
 *
 * Shifts Service
 * จัดการตรรกะที่เกี่ยวกับกะการทำงาน
 */

// import database models and helpers
const ShiftModel = require("./shifts.model");
const pool = require("../../config/database");
const DateUtil = require("../../utilities/date");

// Service Class
class ShiftService {
  // ดึงข้อมูลกะการทำงานทั้งหมด
  async getAllShifts(companyId) {
    if (!companyId) {
      throw new Error("companyId is required");
    }
    return await ShiftModel.findAll(companyId);
  }

  // สร้างกะการทำงานใหม่
  async createShift(shiftData, companyId) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบข้อมูลที่จำเป็น
      if (!companyId) {
        throw new Error("shiftData and companyId are required");
      }

      // ตรวจสอบ shift_name ไม่ให้ซ้ำกันภายในบริษัท
      const existingShift = await ShiftModel.findByName(
        shiftData.shift_name,
        companyId
      );
      if (existingShift) {
        throw new Error("Shift name already exists within the company");
      }

      // แปลงเวลาเป็น format TIME (HH:mm:ss)
      const timeFields = [
        "start_time",
        "end_time",
        "break_start_time",
        "break_end_time",
      ];
      for (const field of timeFields) {
        if (shiftData[field]) {
          shiftData[field] = DateUtil.toDbTime(shiftData[field]);
        }
      }

      // แปลง employeeId และ date เป็น JSON string ถ้าเป็น array
      if (Array.isArray(shiftData.employeeId)) {
        shiftData.employeeId = JSON.stringify(shiftData.employeeId);
      }
      if (Array.isArray(shiftData.date)) {
        shiftData.date = JSON.stringify(shiftData.date);
      }

      // สร้างกะการทำงานใหม่
      const newShift = await ShiftModel.create(shiftData, companyId);

      // commit transaction
      await connection.commit(); // กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      connection.release();
      return newShift;
    } catch (error) {
      // rollback transaction
      await connection.rollback(); // กรณีเกิดข้อผิดพลาด: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      throw error;
    } finally {
      connection.release();
    }
  }

  // อัปเดตกะการทำงาน
  async updateShift(shiftId, shiftData, companyId) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบข้อมูลที่จำเป็น
      if (!shiftId || !companyId) {
        throw new Error("shiftId and companyId are required");
      }

      // แปลงเวลาเป็น format TIME (HH:mm:ss)
      const timeFields = [
        "start_time",
        "end_time",
        "break_start_time",
        "break_end_time",
      ];
      for (const field of timeFields) {
        if (shiftData[field]) {
          shiftData[field] = DateUtil.toDbTime(shiftData[field]);
        }
      }

      // แปลง employeeId และ date เป็น JSON string ถ้าเป็น array
      if (Array.isArray(shiftData.employeeId)) {
        shiftData.employeeId = JSON.stringify(shiftData.employeeId);
      }
      if (Array.isArray(shiftData.date)) {
        shiftData.date = JSON.stringify(shiftData.date);
      }

      await ShiftModel.update(shiftId, shiftData, companyId);

      // commit transaction
      await connection.commit();
      connection.release();

      // ดึงข้อมูลที่อัปเดตแล้วกลับมา
      return await ShiftModel.findById(shiftId, companyId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // มอบหมายกะการทำงานให้พนักงาน เช่น [employeeId1, employeeId2] ได้กะการทำงาน shiftId
  async assignShiftToEmployee(assignmentData, companyId) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      const { shiftId, employeeIds } = assignmentData;
      if (!shiftId || !employeeIds) {
        throw new Error("shiftId and employeeIds are required");
      }

      // ตรวจสอบว่า shift มีอยู่จริง
      const shift = await ShiftModel.findById(shiftId, companyId);
      if (!shift) {
        throw new Error("Shift not found");
      }

      // แปลง employeeIds เป็น JSON string
      const employeeIdJson = Array.isArray(employeeIds)
        ? JSON.stringify(employeeIds)
        : employeeIds;

      // อัปเดต employeeId ใน shift
      const updated = await ShiftModel.assignShiftToEmployee(
        shiftId,
        employeeIdJson,
        companyId
      );

      if (!updated) {
        throw new Error("Failed to assign shift to employees");
      }

      // commit transaction
      await connection.commit();
      connection.release();

      // ดึงข้อมูลที่อัปเดตแล้วกลับมา
      return await ShiftModel.findById(shiftId, companyId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new ShiftService();
