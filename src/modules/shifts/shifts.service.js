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
      throw new Error("กรุณาเข้าสู่ระบบใหม่");
    }
    return await ShiftModel.findAll(companyId);
  }

  // สร้างกะการทำงานใหม่
  async createShift(shiftData, companyId) {
    try {
      // ตรวจสอบข้อมูลที่จำเป็น
      if (!companyId) {
        throw new Error("ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบอีกครั้ง");
      }

      // ตรวจสอบ shift_name ไม่ให้ซ้ำกันภายในบริษัท
      const existingShift = await ShiftModel.findByName(
        shiftData.shift_name,
        companyId
      );
      if (existingShift) {
        throw new Error(`ชื่อกะ "${shiftData.shift_name}" มีอยู่ในระบบแล้ว`);
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

      return newShift;
    } catch (error) {
      console.error("Error creating shift:", error);
      throw error;
    }
  }

  // อัปเดตกะการทำงาน
  async updateShift(shiftId, shiftData, companyId) {
    try {
      // ตรวจสอบข้อมูลที่จำเป็น
      if (!shiftId || !companyId) {
        throw new Error("ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบอีกครั้ง");
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

      // ดึงข้อมูลที่อัปเดตแล้วกลับมา
      return await ShiftModel.findById(shiftId, companyId);
    } catch (error) {
      console.error("Error updating shift:", error);
      throw error;
    }
  }

  // มอบหมายกะการทำงานให้พนักงาน เช่น [employeeId1, employeeId2] ได้กะการทำงาน shiftId
  async assignShiftToEmployee(assignmentData, companyId) {
    try {
      const { shiftId, employeeIds } = assignmentData;
      if (!shiftId || !employeeIds) {
        throw new Error("กรุณาระบุกะและพนักงานที่ต้องการมอบหมาย");
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
        throw new Error("ไม่สามารถมอบหมายกะให้พนักงานได้");
      }

      // ดึงข้อมูลที่อัปเดตแล้วกลับมา
      return await ShiftModel.findById(shiftId, companyId);
    } catch (error) {
      console.error("Error assigning shift to employees:", error);
      throw error;
    }
  }

  // ลบกะการทำงาน
  async deleteShift(shiftId, companyId) {
    try {
      if (!shiftId || !companyId) {
        throw new Error("shiftId and companyId are required");
      }

      // ตรวจสอบว่า shift มีอยู่จริง
      const shift = await ShiftModel.findById(shiftId, companyId);
      if (!shift) {
        throw new Error("Shift not found");
      }

      const deleted = await ShiftModel.delete(shiftId, companyId);
      if (!deleted) {
        throw new Error("Failed to delete shift");
      }

      return true;
    } catch (error) {
      console.error("Error deleting shift:", error);
      throw error;
    }
  }
}

module.exports = new ShiftService();
