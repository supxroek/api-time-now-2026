/**
 * /src/modules/dashboard/dashboard.model.js
 *
 * Dashboard Model
 * จัดการการเชื่อมต่อฐานข้อมูลสำหรับ Dashboard
 */

const pool = require("../../config/database");

class DashboardModel {
  /**
   * ดึงสถิติการเข้างานของวันนี้
   * @param {number} companyId - รหัสบริษัท
   * @param {string} date - วันที่ (YYYY-MM-DD)
   */
  async getTodayStats(companyId, date) {
    // นับจำนวนพนักงานทั้งหมดที่ยังทำงานอยู่
    const [totalEmployees] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM employees 
       WHERE companyId = ? AND resign_date IS NULL`,
      [companyId]
    );

    // ดึงข้อมูลพนักงานที่เข้างานวันนี้ พร้อมกะงาน
    const [attendanceData] = await pool.query(
      `SELECT 
         tr.employeeid,
         tr.start_time,
         tr.end_time,
         tr.break_start_time,
         tr.break_end_time,
         tr.ot_start_time,
         tr.ot_end_time,
         wt.start_time as shift_start_time,
         wt.free_time as grace_period
       FROM timestamp_records tr
       LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
       WHERE tr.companyId = ? AND DATE(tr.created_at) = ?`,
      [companyId, date]
    );

    // คำนวณสถิติ
    let onTimeCount = 0;
    let lateCount = 0;
    let totalLateMinutes = 0;
    let totalCheckInMinutes = 0;
    let totalBreakMinutes = 0;
    let otCount = 0;

    attendanceData.forEach((record) => {
      // คำนวณการเข้างานตรงเวลา/สาย
      if (record.start_time && record.shift_start_time) {
        const checkInMinutes = this._timeToMinutes(record.start_time);
        const shiftStartMinutes = this._timeToMinutes(record.shift_start_time);
        const gracePeriod = Number(record.grace_period ?? 5);

        totalCheckInMinutes += checkInMinutes;

        if (checkInMinutes <= shiftStartMinutes + gracePeriod) {
          onTimeCount++;
        } else {
          lateCount++;
          totalLateMinutes += checkInMinutes - shiftStartMinutes - gracePeriod;
        }
      }

      // คำนวณเวลาพัก
      if (record.break_start_time && record.break_end_time) {
        const breakStart = this._timeToMinutes(record.break_start_time);
        const breakEnd = this._timeToMinutes(record.break_end_time);
        totalBreakMinutes += breakEnd - breakStart;
      }

      // นับ OT
      if (record.ot_start_time) {
        otCount++;
      }
    });

    const checkedInCount = attendanceData.length;
    const absentCount = totalEmployees[0].total - checkedInCount;
    const avgCheckInTime =
      checkedInCount > 0
        ? this._minutesToTime(Math.round(totalCheckInMinutes / checkedInCount))
        : null;
    const avgLateMinutes =
      lateCount > 0 ? Math.round(totalLateMinutes / lateCount) : 0;
    const avgBreakMinutes =
      checkedInCount > 0 ? Math.round(totalBreakMinutes / checkedInCount) : 0;

    return {
      totalEmployees: totalEmployees[0].total,
      checkedInCount,
      onTimeCount,
      lateCount,
      absentCount,
      otCount,
      avgCheckInTime,
      avgLateMinutes,
      avgBreakMinutes,
    };
  }

  /**
   * ดึงรายการ attendance ของวันนี้พร้อมข้อมูลพนักงาน
   * @param {number} companyId - รหัสบริษัท
   * @param {string} date - วันที่ (YYYY-MM-DD)
   * @param {object} options - ตัวเลือก (page, limit, department, status, search)
   */
  async getTodayAttendanceRecords(companyId, date, options = {}) {
    const {
      page = 1,
      limit = 10,
      department = "All",
      status = "All",
      search = "",
    } = options;
    const offset = (page - 1) * limit;

    // สร้าง base query
    let query = `
      SELECT 
        tr.id,
        tr.employeeid,
        tr.start_time as checkIn,
        tr.break_start_time as breakStart,
        tr.break_end_time as breakEnd,
        tr.end_time as checkOut,
        tr.ot_start_time as otCheckIn,
        tr.ot_end_time as otCheckOut,
        tr.created_at,
        e.name as employeeName,
        d.departmentName,
        d.id as departmentId,
        wt.start_time as shift_start_time,
        wt.end_time as shift_end_time,
        wt.free_time as grace_period
      FROM employees e
      LEFT JOIN timestamp_records tr ON e.id = tr.employeeid AND DATE(tr.created_at) = ?
      LEFT JOIN department d ON e.departmentId = d.id
      LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
      WHERE e.companyId = ? AND e.resign_date IS NULL
    `;
    const params = [date, companyId];

    // Filter by department
    if (department && department !== "All") {
      query += " AND d.departmentName = ?";
      params.push(department);
    }

    // Filter by search
    if (search) {
      query += " AND e.name LIKE ?";
      params.push(`%${search}%`);
    }

    // Get total count before pagination
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM employees/,
      "SELECT COUNT(DISTINCT e.id) as total FROM employees"
    );
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0]?.total || 0;

    // Add ordering and pagination
    query += " ORDER BY tr.start_time DESC, e.name ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    // คำนวณ status สำหรับแต่ละ record
    const records = rows.map((row) => {
      let status = "absent";
      if (row.checkIn) {
        const checkInMinutes = this._timeToMinutes(row.checkIn);
        const shiftStartMinutes = this._timeToMinutes(row.shift_start_time);
        const gracePeriod = Number(row.grace_period ?? 5);

        if (checkInMinutes <= shiftStartMinutes + gracePeriod) {
          if (row.checkOut) {
            status = "present";
          } else if (row.breakStart && !row.breakEnd) {
            status = "break";
          } else {
            status = "working";
          }
        } else {
          status = "late";
        }
      }

      return {
        id: row.id || row.employeeid,
        user: {
          name: row.employeeName,
          role: null,
          department: row.departmentName || "ไม่ระบุแผนก",
        },
        date: row.created_at,
        checkIn: row.checkIn || "-",
        breakStart: row.breakStart || "-",
        breakEnd: row.breakEnd || "-",
        checkOut: row.checkOut || "-",
        otCheckIn: row.otCheckIn || "-",
        otCheckOut: row.otCheckOut || "-",
        status,
      };
    });

    // Filter by status if specified
    let filteredRecords = records;
    if (status && status !== "All") {
      filteredRecords = records.filter((r) => r.status === status);
    }

    return {
      records: filteredRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ดึงกิจกรรมล่าสุด (Live Activity)
   * @param {number} companyId - รหัสบริษัท
   * @param {string} date - วันที่ (YYYY-MM-DD)
   * @param {number} limit - จำนวนรายการ
   */
  async getRecentActivities(companyId, date, limit = 20) {
    const [rows] = await pool.query(
      `SELECT 
        tr.id,
        tr.employeeid,
        tr.start_time,
        tr.break_start_time,
        tr.break_end_time,
        tr.end_time,
        tr.ot_start_time,
        tr.ot_end_time,
        tr.created_at,
        e.name as employeeName,
        wt.start_time as shift_start_time,
        wt.free_time as grace_period
      FROM timestamp_records tr
      JOIN employees e ON tr.employeeid = e.id
      LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
      WHERE tr.companyId = ? AND DATE(tr.created_at) = ?
      ORDER BY tr.created_at DESC
      LIMIT ?`,
      [companyId, date, limit]
    );

    // แปลงข้อมูลเป็นรายการกิจกรรม
    const activities = [];
    rows.forEach((row) => {
      const baseActivity = {
        employeeId: row.employeeid,
        user: { name: row.employeeName, avatar: null },
      };

      // เพิ่มกิจกรรม check-in
      if (row.start_time) {
        const checkInMinutes = this._timeToMinutes(row.start_time);
        const shiftStartMinutes = this._timeToMinutes(row.shift_start_time);
        const gracePeriod = Number(row.grace_period ?? 5);
        const isOnTime = checkInMinutes <= shiftStartMinutes + gracePeriod;

        activities.push({
          ...baseActivity,
          id: `${row.id}-checkin`,
          type: "check-in",
          time: row.start_time?.substring(0, 5),
          status: isOnTime ? "ontime" : "late",
          timestamp: row.created_at,
        });
      }

      // เพิ่มกิจกรรม break-start
      if (row.break_start_time) {
        activities.push({
          ...baseActivity,
          id: `${row.id}-breakstart`,
          type: "break-start",
          time: row.break_start_time?.substring(0, 5),
          status: "break",
          timestamp: row.created_at,
        });
      }

      // เพิ่มกิจกรรม break-end
      if (row.break_end_time) {
        activities.push({
          ...baseActivity,
          id: `${row.id}-breakend`,
          type: "break-end",
          time: row.break_end_time?.substring(0, 5),
          status: "working",
          timestamp: row.created_at,
        });
      }

      // เพิ่มกิจกรรม check-out
      if (row.end_time) {
        activities.push({
          ...baseActivity,
          id: `${row.id}-checkout`,
          type: "check-out",
          time: row.end_time?.substring(0, 5),
          status: "ontime",
          timestamp: row.created_at,
        });
      }
    });

    // เรียงตามเวลา
    activities.sort((a, b) => {
      const timeA = a.time || "00:00";
      const timeB = b.time || "00:00";
      return timeB.localeCompare(timeA);
    });

    return activities.slice(0, limit);
  }

  /**
   * ดึงรายชื่อแผนกทั้งหมดของบริษัท
   * @param {number} companyId - รหัสบริษัท
   */
  async getDepartments(companyId) {
    const [rows] = await pool.query(
      `SELECT DISTINCT departmentName 
       FROM department 
       WHERE companyId = ? 
       ORDER BY departmentName`,
      [companyId]
    );
    return ["All", ...rows.map((r) => r.departmentName)];
  }

  /**
   * ดึงประวัติการเข้างานย้อนหลังของพนักงาน
   * @param {number} employeeId - รหัสพนักงาน
   * @param {number} days - จำนวนวันย้อนหลัง
   */
  async getEmployeeHistory(employeeId, days = 5) {
    const [rows] = await pool.query(
      `SELECT 
        tr.id,
        DATE(tr.created_at) as date,
        tr.start_time,
        tr.end_time,
        wt.start_time as shift_start_time,
        wt.free_time as grace_period
      FROM timestamp_records tr
      LEFT JOIN workingTime wt ON tr.workingTimeId = wt.id
      WHERE tr.employeeid = ?
      ORDER BY tr.created_at DESC
      LIMIT ?`,
      [employeeId, days]
    );

    return rows.map((row) => {
      const checkInMinutes = this._timeToMinutes(row.start_time);
      const shiftStartMinutes = this._timeToMinutes(row.shift_start_time);
      const gracePeriod = Number(row.grace_period ?? 5);
      const isOnTime = checkInMinutes <= shiftStartMinutes + gracePeriod;

      return {
        id: row.id,
        date: row.date,
        checkIn: row.start_time?.substring(0, 5) || "-",
        checkOut: row.end_time?.substring(0, 5) || "-",
        status: isOnTime ? "On Time" : "Late",
      };
    });
  }

  // ==================== Helper Methods ====================

  /**
   * แปลงเวลา HH:mm:ss เป็น minutes จากเที่ยงคืน
   */
  _timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * แปลง minutes เป็น HH:mm
   */
  _minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  }
}

module.exports = new DashboardModel();
