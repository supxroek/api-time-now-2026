/**
 * /src/modules/attendance/attendance.model.js
 *
 * Attendance Model
 * จัดการการเชื่อมต่อฐานข้อมูลสำหรับระบบบันทึกเวลาการทำงาน
 */

const pool = require("../../config/database");

// Model Class
class AttendanceModel {
  // ==================== Helper: Find Active Shift ====================

  /**
   * ค้นหากะงานที่ Active สำหรับพนักงานในวันที่กำหนด
   * ลำดับความสำคัญ 1: วันที่เจาะจง (is_specific = 1)
   * ลำดับความสำคัญ 2: กะประจำสัปดาห์ (is_shift = 1 หรือ 0)
   * Fallback: Default Company Rule หรือ null
   */
  async findActiveShift(employeeId, date, companyId) {
    // Priority 1: ค้นหา Specific Date Shift
    const [specificShift] = await pool.query(
      `SELECT wt.* 
       FROM workingTime wt
       WHERE wt.is_specific = 1 
         AND wt.companyId = ?
         AND JSON_CONTAINS(wt.date, JSON_QUOTE(?))
         AND JSON_CONTAINS(wt.employeeId, CAST(? AS JSON))
       LIMIT 1`,
      [companyId, date, employeeId]
    );

    if (specificShift.length > 0) {
      return specificShift[0];
    }

    // Priority 2: ค้นหา Weekly Shift ปกติ
    const dayOfWeek = new Date(date).getDay(); // 0=Sunday, 1=Monday, ...
    const [weeklyShift] = await pool.query(
      `SELECT wt.* 
       FROM workingTime wt
       WHERE wt.is_specific = 0
         AND wt.companyId = ?
         AND JSON_CONTAINS(wt.employeeId, CAST(? AS JSON))
         AND JSON_CONTAINS(wt.dayOfWeek, CAST(? AS JSON))
       LIMIT 1`,
      [companyId, employeeId, dayOfWeek]
    );

    if (weeklyShift.length > 0) {
      return weeklyShift[0];
    }

    // Fallback: ค้นหา Default Company Rule
    const [defaultShift] = await pool.query(
      `SELECT wt.* 
       FROM workingTime wt
       WHERE wt.companyId = ?
         AND wt.is_default = 1
         AND JSON_CONTAINS(wt.dayOfWeek, CAST(? AS JSON))
       LIMIT 1`,
      [companyId, dayOfWeek]
    );

    return defaultShift.length > 0 ? defaultShift[0] : null;
  }

  // ==================== Check-In Methods ====================

  /**
   * ตรวจสอบว่าพนักงานได้ Check-in ไปแล้วในวันนี้หรือยัง
   */
  async findTodayRecord(employeeId, date) {
    const [rows] = await pool.query(
      `SELECT * FROM timestamp_records 
       WHERE employeeId = ? 
         AND DATE(created_at) = ?
       LIMIT 1`,
      [employeeId, date]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * บันทึกเวลาเข้างาน (Check-in)
   */
  async saveCheckIn(data) {
    const {
      employeeId,
      companyId,
      workingTimeId,
      startTime,
      lateStatus,
      lateMinutes = 0, // ค่าเริ่มต้นเป็น 0
      checkInLocation = null, // ค่าเริ่มต้นเป็น null
      checkInNote = null, // ค่าเริ่มต้นเป็น null
    } = data;

    const [result] = await pool.query(
      `INSERT INTO timestamp_records 
       (employeeId, companyId, workingTimeId, start_time, late_status, late_minutes, check_in_location, check_in_note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        employeeId,
        companyId,
        workingTimeId,
        startTime,
        lateStatus,
        lateMinutes,
        checkInLocation,
        checkInNote,
      ]
    );

    return {
      id: result.insertId,
      employeeId,
      startTime,
      lateStatus,
      lateMinutes,
    };
  }

  // ==================== Check-Out Methods ====================

  /**
   * หา Record ที่ยังไม่ได้ Check-out
   */
  async findOpenRecord(employeeId, date) {
    const [rows] = await pool.query(
      `SELECT tr.*, wt.end_time as shift_end_time, wt.start_time as shift_start_time
       FROM timestamp_records tr
       LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
       WHERE tr.employeeId = ? 
         AND DATE(tr.created_at) = ?
         AND tr.end_time IS NULL
       LIMIT 1`,
      [employeeId, date]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * บันทึกเวลาออกงาน (Check-out)
   */
  async saveCheckOut(recordId, data) {
    const {
      endTime,
      earlyLeaveStatus,
      earlyLeaveMinutes = 0, // ค่าเริ่มต้นเป็น 0
      totalWorkMinutes = 0, // ค่าเริ่มต้นเป็น 0
      isPotentialOT = 0, // ค่าเริ่มต้นเป็น 0
      otMinutes = 0, // ค่าเริ่มต้นเป็น 0
      checkOutLocation = null, // ค่าเริ่มต้นเป็น null
      checkOutNote = null, // ค่าเริ่มต้นเป็น null
    } = data;

    await pool.query(
      `UPDATE timestamp_records 
       SET end_time = ?,
           early_leave_status = ?,
           early_leave_minutes = ?,
           total_work_minutes = ?,
           is_potential_ot = ?,
           ot_minutes = ?,
           check_out_location = ?,
           check_out_note = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        endTime,
        earlyLeaveStatus,
        earlyLeaveMinutes,
        totalWorkMinutes,
        isPotentialOT,
        otMinutes,
        checkOutLocation,
        checkOutNote,
        recordId,
      ]
    );

    return {
      id: recordId,
      endTime,
      earlyLeaveStatus,
      earlyLeaveMinutes,
      totalWorkMinutes,
      isPotentialOT,
      otMinutes,
    };
  }

  // ==================== Break Methods ====================

  /**
   * หา Record ที่พร้อมเริ่มพัก (มี start_time, ไม่มี end_time, ไม่มี break_start)
   */
  async findRecordReadyForBreak(employeeId, date) {
    const [rows] = await pool.query(
      `SELECT * FROM timestamp_records 
       WHERE employeeId = ? 
         AND DATE(created_at) = ?
         AND start_time IS NOT NULL
         AND end_time IS NULL
         AND break_start_time IS NULL
       LIMIT 1`,
      [employeeId, date]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * หา Record ที่กำลังพักอยู่ (มี break_start แต่ไม่มี break_end)
   */
  async findRecordOnBreak(employeeId, date) {
    const [rows] = await pool.query(
      `SELECT tr.*, wt.break_duration as allowed_break_minutes
       FROM timestamp_records tr
       LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
       WHERE tr.employeeId = ? 
         AND DATE(tr.created_at) = ?
         AND tr.break_start_time IS NOT NULL
         AND tr.break_end_time IS NULL
       LIMIT 1`,
      [employeeId, date]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * บันทึกเวลาเริ่มพัก
   */
  async saveBreakStart(recordId, breakStartTime) {
    await pool.query(
      `UPDATE timestamp_records 
       SET break_start_time = ?, updated_at = NOW()
       WHERE id = ?`,
      [breakStartTime, recordId]
    );

    return { id: recordId, breakStartTime };
  }

  /**
   * บันทึกเวลาสิ้นสุดการพัก
   */
  async saveBreakEnd(recordId, data) {
    const { breakEndTime, breakDurationMinutes, isOverBreak } = data;

    await pool.query(
      `UPDATE timestamp_records 
       SET break_end_time = ?,
           break_duration_minutes = ?,
           is_over_break = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [breakEndTime, breakDurationMinutes, isOverBreak ? 1 : 0, recordId]
    );

    return { id: recordId, breakEndTime, breakDurationMinutes, isOverBreak };
  }

  // ==================== Query Methods ====================

  /**
   * ดึงข้อมูลการบันทึกเวลาของวันนี้
   */
  async getTodayAttendance(employeeId, date) {
    const [rows] = await pool.query(
      `SELECT tr.*, 
              wt.name as shift_name,
              wt.start_time as shift_start_time,
              wt.end_time as shift_end_time,
              wt.break_duration as allowed_break_minutes
       FROM timestamp_records tr
       LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
       WHERE tr.employeeId = ? 
         AND DATE(tr.created_at) = ?
       LIMIT 1`,
      [employeeId, date]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * ดึงประวัติการบันทึกเวลางาน
   */
  async getAttendanceHistory(employeeId, options = {}) {
    const { startDate, endDate, page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    let query = `
      SELECT tr.*, 
             wt.name as shift_name,
             wt.start_time as shift_start_time,
             wt.end_time as shift_end_time
      FROM timestamp_records tr
      LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
      WHERE tr.employeeId = ?
    `;
    const params = [employeeId];

    if (startDate) {
      query += " AND DATE(tr.created_at) >= ?";
      params.push(startDate);
    }

    if (endDate) {
      query += " AND DATE(tr.created_at) <= ?";
      params.push(endDate);
    }

    query += " ORDER BY tr.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM timestamp_records tr
      WHERE tr.employeeId = ?
    `;
    const countParams = [employeeId];

    if (startDate) {
      countQuery += " AND DATE(tr.created_at) >= ?";
      countParams.push(startDate);
    }

    if (endDate) {
      countQuery += " AND DATE(tr.created_at) <= ?";
      countParams.push(endDate);
    }

    const [countResult] = await pool.query(countQuery, countParams);

    return {
      records: rows,
      pagination: {
        total: countResult[0].total,
        page,
        limit,
        totalPages: Math.ceil(countResult[0].total / limit),
      },
    };
  }

  /**
   * ดึงสรุปการบันทึกเวลางาน (Monthly Summary)
   */
  async getAttendanceSummary(employeeId, month, year) {
    const [summary] = await pool.query(
      `SELECT 
         COUNT(*) as total_days,
         SUM(CASE WHEN late_status = 1 THEN 1 ELSE 0 END) as late_days,
         SUM(CASE WHEN early_leave_status = 1 THEN 1 ELSE 0 END) as early_leave_days,
         SUM(CASE WHEN is_over_break = 1 THEN 1 ELSE 0 END) as over_break_days,
         SUM(COALESCE(total_work_minutes, 0)) as total_work_minutes,
         SUM(COALESCE(ot_minutes, 0)) as total_ot_minutes,
         SUM(COALESCE(late_minutes, 0)) as total_late_minutes,
         SUM(COALESCE(early_leave_minutes, 0)) as total_early_leave_minutes
       FROM timestamp_records
       WHERE employeeId = ?
         AND MONTH(created_at) = ?
         AND YEAR(created_at) = ?`,
      [employeeId, month, year]
    );

    return summary[0];
  }

  /**
   * ดึงข้อมูลพนักงานพร้อม companyId
   */
  async getEmployeeById(employeeId) {
    const [rows] = await pool.query(
      `SELECT id, name, companyId, departmentId 
       FROM employees 
       WHERE id = ?`,
      [employeeId]
    );
    return rows.length > 0 ? rows[0] : null;
  }
}

module.exports = new AttendanceModel();
