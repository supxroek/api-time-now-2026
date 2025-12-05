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
   * ลำดับความสำคัญ 2: กะของพนักงาน (is_shift = 1)
   * Fallback: กะปกติของบริษัท หรือ null
   */
  async findActiveShift(employeeId, date, companyId) {
    // Priority 1: ค้นหา Specific Date Shift (กะเฉพาะวันที่)
    const [specificShift] = await pool.query(
      `SELECT wt.*,
              TIMESTAMPDIFF(MINUTE, wt.break_start_time, wt.break_end_time) as break_duration
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

    // Priority 2: ค้นหา Shift ของพนักงาน (is_shift = 1)
    const [employeeShift] = await pool.query(
      `SELECT wt.*,
              TIMESTAMPDIFF(MINUTE, wt.break_start_time, wt.break_end_time) as break_duration
       FROM workingTime wt
       WHERE wt.is_specific = 0
         AND wt.companyId = ?
         AND JSON_CONTAINS(wt.employeeId, CAST(? AS JSON))
       LIMIT 1`,
      [companyId, employeeId]
    );

    if (employeeShift.length > 0) {
      return employeeShift[0];
    }

    // Fallback: ค้นหากะปกติของบริษัท (ไม่มี employeeId หรือ employeeId เป็น null)
    const [defaultShift] = await pool.query(
      `SELECT wt.*,
              TIMESTAMPDIFF(MINUTE, wt.break_start_time, wt.break_end_time) as break_duration
       FROM workingTime wt
       WHERE wt.companyId = ?
         AND wt.is_specific = 0
         AND (wt.employeeId IS NULL OR wt.employeeId = '[]')
       LIMIT 1`,
      [companyId]
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
       WHERE employeeid = ? 
         AND DATE(created_at) = ?
       LIMIT 1`,
      [employeeId, date]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * บันทึกเวลาเข้างาน (Check-in)
   * Note: ใช้เฉพาะคอลัมน์ที่มีใน timestamp_records table
   */
  async saveCheckIn(data) {
    const { employeeId, companyId, workingTimeId, startTime } = data;

    const [result] = await pool.query(
      `INSERT INTO timestamp_records 
       (employeeid, companyId, workingTimeId, start_time, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [employeeId, companyId, workingTimeId, startTime]
    );

    return {
      id: result.insertId,
      employeeId,
      startTime,
    };
  }

  // ==================== Check-Out Methods ====================

  /**
   * หา Record ที่ยังไม่ได้ Check-out
   */
  async findOpenRecord(employeeId, date) {
    const [rows] = await pool.query(
      `SELECT tr.*, 
              wt.end_time as shift_end_time, 
              wt.start_time as shift_start_time,
              wt.break_start_time as shift_break_start,
              wt.break_end_time as shift_break_end,
              wt.free_time as grace_period,
              TIMESTAMPDIFF(MINUTE, wt.break_start_time, wt.break_end_time) as allowed_break_minutes
       FROM timestamp_records tr
       LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
       WHERE tr.employeeid = ? 
         AND DATE(tr.created_at) = ?
         AND tr.end_time IS NULL
       LIMIT 1`,
      [employeeId, date]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * บันทึกเวลาออกงาน (Check-out)
   * Note: ใช้เฉพาะคอลัมน์ที่มีใน timestamp_records table
   */
  async saveCheckOut(recordId, data) {
    const { endTime } = data;

    await pool.query(
      `UPDATE timestamp_records 
       SET end_time = ?
       WHERE id = ?`,
      [endTime, recordId]
    );

    return {
      id: recordId,
      endTime,
    };
  }

  // ==================== Break Methods ====================

  /**
   * หา Record ที่พร้อมเริ่มพัก (มี start_time, ไม่มี end_time, ไม่มี break_start)
   */
  async findRecordReadyForBreak(employeeId, date) {
    const [rows] = await pool.query(
      `SELECT tr.*,
              TIMESTAMPDIFF(MINUTE, wt.break_start_time, wt.break_end_time) as allowed_break_minutes
       FROM timestamp_records tr
       LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
       WHERE tr.employeeid = ? 
         AND DATE(tr.created_at) = ?
         AND tr.start_time IS NOT NULL
         AND tr.end_time IS NULL
         AND tr.break_start_time IS NULL
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
      `SELECT tr.*, 
              TIMESTAMPDIFF(MINUTE, wt.break_start_time, wt.break_end_time) as allowed_break_minutes
       FROM timestamp_records tr
       LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
       WHERE tr.employeeid = ? 
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
       SET break_start_time = ?
       WHERE id = ?`,
      [breakStartTime, recordId]
    );

    return { id: recordId, breakStartTime };
  }

  /**
   * บันทึกเวลาสิ้นสุดการพัก
   */
  async saveBreakEnd(recordId, data) {
    const { breakEndTime } = data;

    await pool.query(
      `UPDATE timestamp_records 
       SET break_end_time = ?
       WHERE id = ?`,
      [breakEndTime, recordId]
    );

    return { id: recordId, breakEndTime };
  }

  // ==================== Query Methods ====================

  /**
   * ดึงข้อมูลการบันทึกเวลาของวันนี้
   */
  async getTodayAttendance(employeeId, date) {
    const [rows] = await pool.query(
      `SELECT tr.*, 
              wt.shift_name,
              wt.start_time as shift_start_time,
              wt.end_time as shift_end_time,
              wt.break_start_time as shift_break_start,
              wt.break_end_time as shift_break_end,
              wt.free_time as grace_period,
              TIMESTAMPDIFF(MINUTE, wt.break_start_time, wt.break_end_time) as allowed_break_minutes,
              TIMESTAMPDIFF(MINUTE, tr.break_start_time, tr.break_end_time) as break_duration_minutes,
              TIMESTAMPDIFF(MINUTE, tr.start_time, tr.end_time) as total_work_minutes
       FROM timestamp_records tr
       LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
       WHERE tr.employeeid = ? 
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
             wt.shift_name,
             wt.start_time as shift_start_time,
             wt.end_time as shift_end_time,
             wt.free_time as grace_period,
             TIMESTAMPDIFF(MINUTE, tr.start_time, tr.end_time) as total_work_minutes,
             TIMESTAMPDIFF(MINUTE, tr.break_start_time, tr.break_end_time) as break_duration_minutes
      FROM timestamp_records tr
      LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
      WHERE tr.employeeid = ?
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
      WHERE tr.employeeid = ?
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
   * Note: คำนวณ late/early leave จาก comparison กับ shift time ใน SQL
   */
  async getAttendanceSummary(employeeId, month, year) {
    const [summary] = await pool.query(
      `SELECT 
         COUNT(*) as total_days,
         SUM(CASE WHEN tr.start_time > ADDTIME(wt.start_time, SEC_TO_TIME(COALESCE(wt.free_time, 0) * 60)) THEN 1 ELSE 0 END) as late_days,
         SUM(CASE WHEN tr.end_time IS NOT NULL AND tr.end_time < wt.end_time THEN 1 ELSE 0 END) as early_leave_days,
         SUM(
           CASE WHEN TIMESTAMPDIFF(MINUTE, tr.break_start_time, tr.break_end_time) > 
                     TIMESTAMPDIFF(MINUTE, wt.break_start_time, wt.break_end_time) 
           THEN 1 ELSE 0 END
         ) as over_break_days,
         SUM(COALESCE(TIMESTAMPDIFF(MINUTE, tr.start_time, tr.end_time), 0)) as total_work_minutes,
         SUM(
           CASE WHEN tr.otStatus = 1 AND tr.ot_start_time IS NOT NULL AND tr.ot_end_time IS NOT NULL
           THEN TIMESTAMPDIFF(MINUTE, tr.ot_start_time, tr.ot_end_time) ELSE 0 END
         ) as total_ot_minutes,
         SUM(
           CASE WHEN tr.start_time > ADDTIME(wt.start_time, SEC_TO_TIME(COALESCE(wt.free_time, 0) * 60))
           THEN TIMESTAMPDIFF(MINUTE, ADDTIME(wt.start_time, SEC_TO_TIME(COALESCE(wt.free_time, 0) * 60)), tr.start_time)
           ELSE 0 END
         ) as total_late_minutes,
         SUM(
           CASE WHEN tr.end_time IS NOT NULL AND tr.end_time < wt.end_time
           THEN TIMESTAMPDIFF(MINUTE, tr.end_time, wt.end_time)
           ELSE 0 END
         ) as total_early_leave_minutes
       FROM timestamp_records tr
       LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
       WHERE tr.employeeid = ?
         AND MONTH(tr.created_at) = ?
         AND YEAR(tr.created_at) = ?`,
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
