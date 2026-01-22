/**
 * /src/modules/overtime/overtime.service.js
 *
 * Overtime Service
 * สำหรับจัดการ logic ชั่วโมงทำงานล่วงเวลา
 */

// import models and helpers
const OvertimeModel = require("./overtime.model");
const pool = require("../../config/database");
const DateUtil = require("../../utilities/date");

// Service Class
class OvertimeService {
  // ดึงข้อมูลชั่วโมงทำงานล่วงเวลาทั้งหมด
  async getAllOvertimes(companyId) {
    if (!companyId) {
      throw new Error("กรุณาเข้าสู่ระบบใหม่");
    }
    return await OvertimeModel.findAll(companyId);
  }

  // สร้างชั่วโมงทำงานล่วงเวลาใหม่
  async createOvertime(overtimeData, companyId) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    // แปลงเวลาเริ่มต้นและเวลาสิ้นสุดเป็นรูปแบบ TIME (HH:mm:ss)
    if (overtimeData.ot_start_time) {
      overtimeData.ot_start_time = DateUtil.toDbTime(
        overtimeData.ot_start_time
      );
    }
    if (overtimeData.ot_end_time) {
      overtimeData.ot_end_time = DateUtil.toDbTime(overtimeData.ot_end_time);
    }

    try {
      // ตรวจสอบข้อมูลที่จำเป็น
      if (!companyId) {
        throw new Error("ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบอีกครั้ง");
      }
      // ตรวจสอบชื่อชั่วโมงทำงานล่วงเวลาไม่ให้ซ้ำกันภายในบริษัท
      const existingOvertime = await OvertimeModel.findByName(
        overtimeData.overTimeName,
        companyId
      );

      if (existingOvertime) {
        throw new Error(
          `ชื่อ OT "${overtimeData.overTimeName}" มีอยู่ในระบบแล้ว`
        );
      }

      const newOvertime = await OvertimeModel.create(overtimeData, companyId);

      // commit transaction
      await connection.commit(); // กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      connection.release();
      return newOvertime;
    } catch (error) {
      // rollback transaction
      await connection.rollback(); // กรณีล้มเหลว: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      throw error;
    } finally {
      connection.release();
    }
  }

  // อัปเดตชั่วโมงทำงานล่วงเวลา
  async updateOvertime(id, overtimeData, companyId) {
    // แปลงเวลาเริ่มต้นและเวลาสิ้นสุดเป็นรูปแบบ TIME (HH:mm:ss)
    if (overtimeData.ot_start_time) {
      overtimeData.ot_start_time = DateUtil.toDbTime(
        overtimeData.ot_start_time
      );
    }
    if (overtimeData.ot_end_time) {
      overtimeData.ot_end_time = DateUtil.toDbTime(overtimeData.ot_end_time);
    }

    return await OvertimeModel.update(id, overtimeData, companyId);
  }

  // ลบชั่วโมงทำงานล่วงเวลา
  async deleteOvertime(id, companyId) {
    return await OvertimeModel.delete(id, companyId);
  }
}

module.exports = new OvertimeService();
