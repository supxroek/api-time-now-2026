/**
 * /src/modules/attendance/attendance.service.js
 *
 * Attendance Service
 * จัดการ logic ที่เกี่ยวกับการบันทึกเวลาการทำงาน
 */

// import models and utilities
const AttendanceModel = require("./attendance.model");
const DateUtil = require("../../utilities/date");
const pool = require("../../config/database");

require("dotenv").config();

// Constants - ค่าคงที่ สามารถปรับเปลี่ยนได้ตามนโยบายของบริษัท
// รองรับการตั้งค่าผ่าน environment variables
const {
  GRACE_PERIOD_MINUTES = 5, // เวลาผ่อนผันก่อนถือว่าสาย (นาที)
  OT_THRESHOLD_MINUTES = 60, // เวลาขั้นต่ำที่ถือว่าเป็น OT (นาที)
} = process.env;

// Attendance Status States
const ATTENDANCE_STATE = {
  READY_TO_CHECK_IN: "READY_TO_CHECK_IN", // ยังไม่ได้เช็คอิน
  WORKING: "WORKING", // กำลังทำงาน
  ON_BREAK: "ON_BREAK", // กำลังพัก
  COMPLETED: "COMPLETED", // บันทึกเวลางานครบถ้วนแล้ว
};

// Service Class
class AttendanceService {
  // ==================== Helper Methods ====================

  // Helper Methods: แปลงเวลา HH:mm:ss เป็น minutes จากเที่ยงคืน
  _timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }

  // Helper Methods: คำนวณความต่างของเวลาเป็นนาที
  // ความต่างเป็นนาที (time1 - time2)
  _calculateTimeDiffMinutes(time1, time2) {
    return this._timeToMinutes(time1) - this._timeToMinutes(time2);
  }

  // Helper Methods: ดึงเวลาปัจจุบันในรูปแบบ HH:mm:ss
  _getCurrentTime() {
    return DateUtil.now().format("HH:mm:ss");
  }

  // Helper Methods: ดึงวันที่ปัจจุบันในรูปแบบ YYYY-MM-DD
  _getCurrentDate() {
    return DateUtil.now().format("YYYY-MM-DD");
  }

  // ==================== Check-In Logic ====================

  /**
   * บันทึกเวลาเข้างาน (Check-in)
   */
  async checkIn(employeeId, checkInData) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const currentDate = this._getCurrentDate();
      const currentTime = this._getCurrentTime();

      // 1. ตรวจสอบว่า Check-in ไปแล้วหรือยัง
      const existingRecord = AttendanceModel.findTodayRecord(
        employeeId,
        currentDate
      );

      if (existingRecord) {
        throw new Error("คุณได้บันทึกเวลาเข้างานสำหรับวันนี้แล้ว");
      }

      // 2. ดึงข้อมูลพนักงานเพื่อหา companyId
      const employee = AttendanceModel.getEmployeeById(employeeId);
      if (!employee) {
        throw new Error("ไม่พบข้อมูลพนักงาน");
      }

      // 3. หากะงาน (Shift) ของวันนี้
      const shift = AttendanceModel.findActiveShift(
        employeeId,
        currentDate,
        employee.companyId
      );

      if (!shift) {
        throw new Error("ไม่พบกะงานสำหรับวันนี้");
      }

      // 4. คำนวณสถานะ Late
      const shiftStartMinutes = this._timeToMinutes(shift.start_time);
      const currentMinutes = this._timeToMinutes(currentTime);
      const gracePeriod = shift.grace_period || GRACE_PERIOD_MINUTES;

      const lateMinutes = Math.max(
        0,
        currentMinutes - shiftStartMinutes - gracePeriod
      );
      const isLate = lateMinutes > 0;

      // 5. บันทึกข้อมูล
      const result = AttendanceModel.saveCheckIn({
        employeeId,
        companyId: employee.companyId,
        workingTimeId: shift.id,
        startTime: currentTime,
        lateStatus: isLate ? 1 : 0,
        lateMinutes: isLate ? lateMinutes : 0,
        checkInLocation: checkInData.location || null,
        checkInNote: checkInData.note || null,
      });

      await connection.commit();

      return {
        success: true,
        message: isLate
          ? `เข้างานสำเร็จ (สาย ${lateMinutes} นาที)`
          : "เข้างานสำเร็จ (ตรงเวลา)",
        data: {
          recordId: result.id,
          checkInTime: currentTime,
          shiftStartTime: shift.start_time,
          isLate,
          lateMinutes: isLate ? lateMinutes : 0,
          shiftName: shift.name || "กะปกติ",
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== Check-Out Logic ====================

  /**
   * บันทึกเวลาออกงาน (Check-out)
   */
  async checkOut(employeeId, checkOutData) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const currentDate = this._getCurrentDate();
      const currentTime = this._getCurrentTime();

      // 1. หา Record ที่ยังไม่ได้ Check-out
      const openRecord = AttendanceModel.findOpenRecord(
        employeeId,
        currentDate
      );

      if (!openRecord) {
        throw new Error("ไม่พบข้อมูลการบันทึกเวลางานที่ยังไม่ได้ออกงาน");
      }

      // 2. ตรวจสอบว่ากำลังพักอยู่หรือไม่
      if (openRecord.break_start_time && !openRecord.break_end_time) {
        throw new Error("กรุณากดสิ้นสุดการพักก่อนทำการออกงาน");
      }

      // 3. คำนวณสถานะ Early Leave
      const shiftEndMinutes = this._timeToMinutes(openRecord.shift_end_time);
      const currentMinutes = this._timeToMinutes(currentTime);

      const earlyLeaveMinutes = Math.max(0, shiftEndMinutes - currentMinutes);
      const isEarlyLeave = earlyLeaveMinutes > 0;

      // 4. คำนวณเวลาทำงานรวม
      const startMinutes = this._timeToMinutes(openRecord.start_time);
      let totalWorkMinutes = currentMinutes - startMinutes;

      // หักเวลาพัก (ถ้ามี)
      if (openRecord.break_duration_minutes) {
        totalWorkMinutes -= openRecord.break_duration_minutes;
      }

      // 5. คำนวณ OT (ถ้าทำงานเกินเวลาเลิกงาน)
      const otMinutes = Math.max(0, currentMinutes - shiftEndMinutes);
      const isPotentialOT = otMinutes >= OT_THRESHOLD_MINUTES;

      // 6. บันทึกข้อมูล
      const result = AttendanceModel.saveCheckOut(openRecord.id, {
        endTime: currentTime,
        earlyLeaveStatus: isEarlyLeave ? 1 : 0,
        earlyLeaveMinutes: isEarlyLeave ? earlyLeaveMinutes : 0,
        totalWorkMinutes: Math.max(0, totalWorkMinutes),
        isPotentialOT,
        otMinutes: isPotentialOT ? otMinutes : 0,
        checkOutLocation: checkOutData.location || null,
        checkOutNote: checkOutData.note || null,
      });

      // 7. ตรวจสอบว่าบันทึกสำเร็จหรือไม่
      if (!result) {
        throw new Error("ไม่สามารถบันทึกเวลาออกงานได้");
      }

      await connection.commit();

      let message;
      if (isEarlyLeave) {
        message = `ออกงานสำเร็จ (ออกก่อนเวลา ${earlyLeaveMinutes} นาที)`;
      } else if (isPotentialOT) {
        message = `ออกงานสำเร็จ (มี OT ${otMinutes} นาที รอการอนุมัติ)`;
      } else {
        message = "ออกงานสำเร็จ";
      }

      return {
        success: true,
        message,
        data: {
          recordId: openRecord.id,
          checkInTime: openRecord.start_time,
          checkOutTime: currentTime,
          shiftEndTime: openRecord.shift_end_time,
          isEarlyLeave,
          earlyLeaveMinutes: isEarlyLeave ? earlyLeaveMinutes : 0,
          totalWorkMinutes: Math.max(0, totalWorkMinutes),
          isPotentialOT,
          otMinutes: isPotentialOT ? otMinutes : 0,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== Break Logic ====================

  /**
   * บันทึกเวลาเริ่มพัก
   */
  async breakStart(employeeId, breakData) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const currentDate = this._getCurrentDate();
      const currentTime = this._getCurrentTime();

      // 1. หา Record ที่พร้อมเริ่มพัก
      const record = AttendanceModel.findRecordReadyForBreak(
        employeeId,
        currentDate
      );

      if (!record) {
        // ตรวจสอบว่ากำลังพักอยู่หรือไม่
        const onBreakRecord = AttendanceModel.findRecordOnBreak(
          employeeId,
          currentDate
        );

        if (onBreakRecord) {
          throw new Error("คุณกำลังพักอยู่ ไม่สามารถเริ่มพักซ้ำได้");
        }

        throw new Error(
          "ไม่สามารถเริ่มพักได้ กรุณา Check-in ก่อน หรือคุณ Check-out ไปแล้ว"
        );
      }

      // 2. บันทึกเวลาเริ่มพัก
      const result = AttendanceModel.saveBreakStart(record.id, currentTime);

      // 3. ตรวจสอบว่าบันทึกสำเร็จหรือไม่
      if (!result) {
        throw new Error("ไม่สามารถบันทึกเวลาเริ่มพักได้");
      }

      await connection.commit();

      return {
        success: true,
        message: "เริ่มพักสำเร็จ",
        data: {
          recordId: record.id,
          breakStartTime: currentTime,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * บันทึกเวลาสิ้นสุดการพัก
   */
  async breakEnd(employeeId, breakData) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const currentDate = this._getCurrentDate();
      const currentTime = this._getCurrentTime();

      // 1. หา Record ที่กำลังพักอยู่
      const record = AttendanceModel.findRecordOnBreak(employeeId, currentDate);

      if (!record) {
        throw new Error("ไม่พบข้อมูลการพัก หรือคุณยังไม่ได้เริ่มพัก");
      }

      // 2. คำนวณระยะเวลาพัก
      const breakStartMinutes = this._timeToMinutes(record.break_start_time);
      const currentMinutes = this._timeToMinutes(currentTime);
      const breakDurationMinutes = currentMinutes - breakStartMinutes;

      // 3. ตรวจสอบว่าพักเกินเวลาที่อนุญาตหรือไม่
      const allowedBreakMinutes = Number(record.allowed_break_minutes ?? 60); // default 60 นาที
      const isOverBreak = breakDurationMinutes > allowedBreakMinutes;

      // 4. บันทึกเวลาสิ้นสุดการพัก
      const result = AttendanceModel.saveBreakEnd(record.id, {
        breakEndTime: currentTime,
        breakDurationMinutes,
        isOverBreak,
      });

      // 5. ตรวจสอบว่าบันทึกสำเร็จหรือไม่
      if (!result) {
        throw new Error("ไม่สามารถบันทึกเวลาสิ้นสุดการพักได้");
      }

      await connection.commit();

      return {
        success: true,
        message: isOverBreak
          ? `สิ้นสุดการพัก (พักเกินเวลา ${
              breakDurationMinutes - allowedBreakMinutes
            } นาที)`
          : "สิ้นสุดการพักสำเร็จ",
        data: {
          recordId: record.id,
          breakStartTime: record.break_start_time,
          breakEndTime: currentTime,
          breakDurationMinutes,
          allowedBreakMinutes,
          isOverBreak,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== Query Methods ====================

  /**
   * ดึงข้อมูลการบันทึกเวลาของวันนี้ พร้อมสถานะ
   */
  async getTodayAttendance(employeeId) {
    const currentDate = this._getCurrentDate();
    const record = AttendanceModel.getTodayAttendance(employeeId, currentDate);

    // กำหนดสถานะตาม conditions
    let state = ATTENDANCE_STATE.READY_TO_CHECK_IN;

    if (record) {
      if (record.end_time) {
        // มี end_time ครบแล้ว
        state = ATTENDANCE_STATE.COMPLETED;
      } else if (record.break_start_time && !record.break_end_time) {
        // กำลังพักอยู่
        state = ATTENDANCE_STATE.ON_BREAK;
      } else {
        // มี start_time แต่ยังไม่ check-out
        state = ATTENDANCE_STATE.WORKING;
      }
    }

    return {
      state,
      record: record
        ? {
            id: record.id,
            checkInTime: record.start_time,
            checkOutTime: record.end_time,
            breakStartTime: record.break_start_time,
            breakEndTime: record.break_end_time,
            shiftName: record.shift_name,
            shiftStartTime: record.shift_start_time,
            shiftEndTime: record.shift_end_time,
            isLate: record.late_status === 1,
            lateMinutes: record.late_minutes,
            isEarlyLeave: record.early_leave_status === 1,
            earlyLeaveMinutes: record.early_leave_minutes,
            totalWorkMinutes: record.total_work_minutes,
            breakDurationMinutes: record.break_duration_minutes,
            isOverBreak: record.is_over_break === 1,
            isPotentialOT: record.is_potential_ot === 1,
            otMinutes: record.ot_minutes,
          }
        : null,
      date: currentDate,
    };
  }

  /**
   * ดึงประวัติการบันทึกเวลางาน
   */
  async getAttendanceHistory(employeeId, options = {}) {
    const result = AttendanceModel.getAttendanceHistory(employeeId, options);

    // แปลงข้อมูลให้อ่านง่ายขึ้น
    const formattedRecords = result.records.map((record) => ({
      id: record.id,
      date: DateUtil.toDbDate(record.created_at),
      checkInTime: record.start_time,
      checkOutTime: record.end_time,
      shiftName: record.shift_name,
      shiftStartTime: record.shift_start_time,
      shiftEndTime: record.shift_end_time,
      isLate: record.late_status === 1,
      lateMinutes: record.late_minutes,
      isEarlyLeave: record.early_leave_status === 1,
      earlyLeaveMinutes: record.early_leave_minutes,
      totalWorkMinutes: record.total_work_minutes,
      breakDurationMinutes: record.break_duration_minutes,
      isOverBreak: record.is_over_break === 1,
      isPotentialOT: record.is_potential_ot === 1,
      otMinutes: record.ot_minutes,
    }));

    return {
      records: formattedRecords,
      pagination: result.pagination,
    };
  }

  /**
   * ดึงสรุปการบันทึกเวลางาน (Monthly Summary)
   */
  async getAttendanceSummary(employeeId, options = {}) {
    const now = DateUtil.now();
    const month = options.month ? options.month : now.month() + 1; // เช็คว่า options.month มีค่าหรือไม่ (ถ้าไม่มีใช้เดือนปัจจุบัน)
    const year = options.year ? options.year : now.year();

    const summary = AttendanceModel.getAttendanceSummary(
      employeeId,
      month,
      year
    );

    // แปลงเป็นชั่วโมง:นาที
    const formatMinutesToHoursMinutes = (minutes) => {
      if (!minutes) return "0:00";
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}:${mins.toString().padStart(2, "0")}`;
    };

    return {
      period: {
        month,
        year,
        monthName: now.month(month - 1).format("MMMM"),
      },
      statistics: {
        totalDays: Number(summary.total_days ?? 0),
        lateDays: Number(summary.late_days ?? 0),
        earlyLeaveDays: Number(summary.early_leave_days ?? 0),
        overBreakDays: Number(summary.over_break_days ?? 0),
      },
      workTime: {
        totalWorkMinutes: Number(summary.total_work_minutes ?? 0),
        totalWorkFormatted: formatMinutesToHoursMinutes(
          Number(summary.total_work_minutes ?? 0)
        ),
        totalOTMinutes: Number(summary.total_ot_minutes ?? 0),
        totalOTFormatted: formatMinutesToHoursMinutes(
          Number(summary.total_ot_minutes ?? 0)
        ),
      },
      penalties: {
        totalLateMinutes: Number(summary.total_late_minutes ?? 0),
        totalLateFormatted: formatMinutesToHoursMinutes(
          Number(summary.total_late_minutes ?? 0)
        ),
        totalEarlyLeaveMinutes: Number(summary.total_early_leave_minutes ?? 0),
        totalEarlyLeaveFormatted: formatMinutesToHoursMinutes(
          Number(summary.total_early_leave_minutes ?? 0)
        ),
      },
    };
  }
}

module.exports = new AttendanceService();
