/**
 * /src/modules/employees/employee.service.js
 *
 * Employees Service
 * ชั้นบริการสำหรับการจัดการข้อมูลพนักงาน
 */

// import models and helpers
const pool = require("../../config/database");
const EmployeeModel = require("./employee.model");
const Duration = require("../../utilities/duration");

// Service Class
class EmployeeService {
  // ดึงรายการพนักงานทั้งหมดของบริษัททีผู้ใช้สังกัด
  async getEmployees(companyId) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("companyId is required");
    }

    // ดึงพนักงาน
    const employees = await EmployeeModel.findAllByCompanyId(companyId);
    // ตรวจสอบคอลัมน์ resign_date ว่าเป็น NULL หรือไม่ (พนักงานที่ยังไม่ลาออก)
    // หากไม่เป็น null ให้ตรวจสอบว่าวันที่ลาออกต้องมากกว่าวันที่ปัจจุบัน (resign_date > current date)
    const currentDate = new Date();
    // กรองเอาเฉพาะพนักงานที่ยังไม่ลาออก
    const filteredEmployees = employees.filter((employee) => {
      if (!employee.resign_date) {
        return true; // ยังไม่ลาออก
      }
      const resignDate = new Date(employee.resign_date);
      return resignDate > currentDate; // ยังไม่ถึงวันลาออก
    });

    return filteredEmployees;
  }

  // สร้างพนักงานใหม่สำหรับบริษัทที่ระบุ
  async createEmployee(companyId, employeeData) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบ companyId
      if (!companyId || !employeeData) {
        throw new Error("companyId and employeeData are required");
      }
      // ตรวจสอบ ID_or_Passport_Number และ lineUserId ไม่ให้ซ้ำกันภายในบริษัท
      const existingEmployees = await EmployeeModel.findAllByCompanyId(
        companyId
      );
      const isDuplicate = existingEmployees.some(
        (emp) =>
          emp.ID_or_Passport_Number === employeeData.ID_or_Passport_Number ||
          emp.lineUserId === employeeData.lineUserId
      );
      if (isDuplicate) {
        throw new Error(
          `Employee with ID_or_Passport_Number:${employeeData.ID_or_Passport_Number} or lineUserId:${employeeData.lineUserId} already exists within the company`
        );
      }

      // กำหนดค่าเริ่มต้นหากไม่ได้ระบุ สร้างเป็น Object
      const defaultEmployeeData = {
        name: null,
        ID_or_Passport_Number: null,
        lineUserId: null,
        start_date: null,
        departmentId: null,
        dayOff: null,
      };
      employeeData = { ...defaultEmployeeData, ...employeeData };

      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      // สร้างพนักงานใหม่
      return await EmployeeModel.create(companyId, employeeData);
    } catch (error) {
      // rollback transaction - กรณีล้มเหลว: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  // ดึงข้อมูลพนักงานตาม ID สำหรับบริษัทที่ระบุ
  async getEmployeeById(companyId, employeeId) {
    if (!companyId) {
      throw new Error("companyId is required");
    }
    if (!employeeId) {
      throw new Error("employeeId is required");
    }

    // ดึงพนักงาน
    const employee = await EmployeeModel.findById(companyId, employeeId);
    // ตรวจสอบว่ามีข้อมูลพนักงานหรือไม่
    if (!employee) {
      throw new Error(`Employee with ID:${employeeId} not found`);
    }

    return employee;
  }

  // อัปเดตข้อมูลพนักงานตาม ID สำหรับบริษัทที่ระบุ
  async updateEmployee(companyId, employeeId, updateData) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบ companyId
      if (!companyId) {
        throw new Error("companyId is required");
      }
      if (!employeeId) {
        throw new Error("employeeId is required");
      }

      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      // อัปเดตพนักงาน
      return await EmployeeModel.updateByIdAndCompanyId(
        companyId,
        employeeId,
        updateData
      );
    } catch (error) {
      // rollback transaction - กรณีล้มเหลว: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  // เมื่อพนักงานลาออก อัปเดตวันที่ลาออกตาม ID สำหรับบริษัทที่ระบุ
  async resignEmployee(companyId, employeeId, resignDate) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบ companyId
      if (!companyId) {
        throw new Error("companyId is required");
      }
      if (!employeeId) {
        throw new Error("employeeId is required");
      }
      if (!resignDate) {
        throw new Error("resignDate is required");
      }

      // แปลง resignDate เป็นวัตถุ Date
      const parsedResignDate = await Duration.parseISOToDate(resignDate);
      // ตรวจสอบให้แน่ใจว่า resignDate ไม่อยู่ก่อน start_date ของพนักงาน
      const employee = await EmployeeModel.findById(companyId, employeeId);
      if (!employee) {
        throw new Error(`Employee with ID:${employeeId} not found`);
      }
      const startDate = employee.start_date
        ? new Date(employee.start_date)
        : null;
      if (startDate && parsedResignDate < startDate) {
        throw new Error("resignDate cannot be earlier than start_date");
      }

      resignDate = parsedResignDate;

      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      // อัพเดตพนักงาน
      return await EmployeeModel.resignByIdAndCompanyId(
        companyId,
        employeeId,
        resignDate
      );
    } catch (error) {
      // rollback transaction - กรณีล้มเหลว: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  // ฟังก์ชันพิเศษ: นำเข้าข้อมูลพนักงานจำนวนมาก (Bulk Import) — ลดความซับซ้อน
  async importEmployees(companyId, employeesData) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    // ตัวช่วย: ตรวจสอบอินพุตและปรับรูปแบบข้อมูลให้เป็นมาตรฐาน
    const normalizeInput = (data) => {
      if (!Array.isArray(data)) {
        throw new TypeError("employeesData must be an array");
      }
      const defaultEmployeeData = {
        name: null,
        ID_or_Passport_Number: null,
        lineUserId: null,
        start_date: null,
        departmentId: null,
        dayOff: null,
      };
      return data.map((emp, idx) => ({
        __inputIndex: idx,
        ...defaultEmployeeData,
        ...(emp ?? {}),
      }));
    };

    // ตัวช่วย: หาค่าที่ซ้ำกันสำหรับคีย์ที่กำหนดภายในอาเรย์
    const findDuplicatesForKey = (data, key) => {
      const seen = new Set();
      const duplicates = new Set();
      for (const item of data) {
        const val = item[key];
        if (val === null || val === undefined || val === "") continue;
        if (seen.has(val)) duplicates.add(val);
        else seen.add(val);
      }
      return Array.from(duplicates);
    };

    try {
      if (!companyId) {
        throw new Error("companyId is required");
      }

      // ปรับรูปแบบข้อมูลอินพุต
      employeesData = normalizeInput(employeesData);

      // ตรวจหาค่าซ้ำภายในข้อมูลนำเข้า
      const duplicateIDsInImport = findDuplicatesForKey(
        employeesData,
        "ID_or_Passport_Number"
      );
      const duplicateLinesInImport = findDuplicatesForKey(
        employeesData,
        "lineUserId"
      );

      // โหลดข้อมูลพนักงานที่มีอยู่แล้วเพียงครั้งเดียว
      const existingEmployees = await EmployeeModel.findAllByCompanyId(
        companyId
      );
      const existingIDSet = new Set(
        existingEmployees
          .map((e) => e.ID_or_Passport_Number)
          .filter((v) => v !== null && v !== undefined && v !== "")
      );
      const existingLineSet = new Set(
        existingEmployees
          .map((e) => e.lineUserId)
          .filter((v) => v !== null && v !== undefined && v !== "")
      );

      // เตรียมสรุปผลและการตัดสินใจ
      const summary = {
        attempted: employeesData.length,
        inserted: 0,
        skipped: [],
        failed: [],
        decisions: [],
      };

      // จัดประเภทเรคคอร์ด: คืนค่าเป็น null (ข้าม) หรืออ็อบเจ็กต์ payload สำหรับการแทรก
      const classifyRecord = (emp) => {
        const reasons = [];
        const id = emp.ID_or_Passport_Number;
        const line = emp.lineUserId;

        if (!id && !line)
          reasons.push("missing both ID_or_Passport_Number and lineUserId");
        if (id && duplicateIDsInImport.includes(id))
          reasons.push("duplicate ID_or_Passport_Number in import");
        if (line && duplicateLinesInImport.includes(line))
          reasons.push("duplicate lineUserId in import");
        if (id && existingIDSet.has(id))
          reasons.push("ID_or_Passport_Number already exists in company");
        if (line && existingLineSet.has(line))
          reasons.push("lineUserId already exists in company");

        if (reasons.length > 0) {
          summary.skipped.push({
            index: emp.__inputIndex,
            data: { ID_or_Passport_Number: id, lineUserId: line },
            reasons,
          });
          summary.decisions.push(
            `Skipped record at index ${emp.__inputIndex}: ${reasons.join("; ")}`
          );
          return null;
        }

        const payload = { ...emp };
        delete payload.__inputIndex;
        return { payload, originalIndex: emp.__inputIndex };
      };

      // สร้างรายการที่จะแทรก
      const toInsert = [];
      for (const emp of employeesData) {
        const item = classifyRecord(emp);
        if (item) toInsert.push(item);
      }

      // ทำการแทรกทีละรายการ; ให้ try/catch ด้านนอกจัดการ rollback เมื่อเกิดข้อผิดพลาด
      for (const item of toInsert) {
        await EmployeeModel.create(companyId, item.payload);
        summary.inserted += 1;
        summary.decisions.push(
          `Inserted record from input index ${item.originalIndex}`
        );
      }

      await connection.commit();

      return {
        message: "Import completed",
        summary,
        duplicateIDsInImport,
        duplicateLinesInImport,
      };
    } catch (error) {
      try {
        await connection.rollback();
      } catch (e) {
        console.error("Rollback failed:", e);
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new EmployeeService();
