/**
 * /api/models/timestamp.model.js
 *
 * TimestampRecord Model - Operation & Logging Domain
 * บันทึกเวลาจริง (In/Out/Break)
 * Table นี้จะมีข้อมูลไหลเข้าเยอะที่สุดและขยายตัวเร็ว
 *
 * Relationships:
 *   - belongsTo -> Employee, WorkingTime, Overtime
 *
 * Important: ต้องใช้ Index idx_timestamp_employee_date เพื่อ performance
 */

const BaseModel = require("./base.model");

class TimestampRecordModel extends BaseModel {
  constructor() {
    super(
      "timestamp_records", // tableName
      "id", // primaryKey
      [], // hiddenFields
      [
        // fillable fields
        "company_id",
        "employee_id",
        "working_time_id",
        "overtime_id",
        "record_date",
        "check_in_time",
        "check_out_time",
        "break_start_time",
        "break_end_time",
        "check_in_type",
        "check_out_type",
        "check_in_location",
        "check_out_location",
        "check_in_device_id",
        "check_out_device_id",
        "is_late",
        "late_minutes",
        "is_early_leave",
        "early_leave_minutes",
        "is_ot",
        "ot_minutes",
        "notes",
        "status",
      ]
    );
  }

  // ========================================
  // Date Scopes - ลดการเขียน WHERE ซ้ำๆ
  // ========================================

  /** -----------------------------------------------------------------------
   * สร้าง WHERE clause สำหรับช่วงวันที่
   */
  scopeDateRange(startDate, endDate) {
    return `record_date BETWEEN '${startDate}' AND '${endDate}'`;
  }

  /** -----------------------------------------------------------------------
   * สร้าง WHERE clause สำหรับวันนี้
   */
  scopeToday() {
    return `DATE(record_date) = CURDATE()`;
  }

  /** -----------------------------------------------------------------------
   * สร้าง WHERE clause สำหรับเดือนนี้
   */
  scopeCurrentMonth() {
    return `YEAR(record_date) = YEAR(CURDATE()) AND MONTH(record_date) = MONTH(CURDATE())`;
  }

  /** -----------------------------------------------------------------------
   * สร้าง WHERE clause สำหรับสัปดาห์นี้
   */
  scopeCurrentWeek() {
    return `YEARWEEK(record_date, 1) = YEARWEEK(CURDATE(), 1)`;
  }

  // ========================================
  // Custom Queries
  // ========================================

  /** -----------------------------------------------------------------------
   * ค้นหา timestamp ของพนักงานวันนี้
   */
  async findTodayByEmployee(employeeId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE employee_id = ? AND ${this.scopeToday()}
      ORDER BY id DESC
      LIMIT 1
    `;
    const rows = await this.query(sql, [employeeId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /** -----------------------------------------------------------------------
   * ค้นหา timestamps ของพนักงานในช่วงวันที่
   */
  async findByEmployeeAndDateRange(employeeId, startDate, endDate) {
    const sql = `
      SELECT 
        t.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM ${this.tableName} t
      JOIN employees e ON e.id = t.employee_id
      WHERE t.employee_id = ? AND ${this.scopeDateRange(startDate, endDate)}
      ORDER BY t.record_date DESC
    `;
    return this.query(sql, [employeeId]);
  }

  /** -----------------------------------------------------------------------
   * ค้นหา timestamps ของพนักงานในเดือนนี้
   */
  async findCurrentMonthByEmployee(employeeId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE employee_id = ? AND ${this.scopeCurrentMonth()}
      ORDER BY record_date DESC
    `;
    return this.query(sql, [employeeId]);
  }

  /** -----------------------------------------------------------------------
   * ค้นหา timestamps ทั้งหมดของบริษัทวันนี้
   */
  async findTodayByCompany(companyId) {
    const sql = `
      SELECT 
        t.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.department_name
      FROM ${this.tableName} t
      JOIN employees e ON e.id = t.employee_id
      LEFT JOIN department d ON d.id = e.department_id
      WHERE t.company_id = ? AND ${this.scopeToday()}
      ORDER BY t.check_in_time ASC
    `;
    return this.query(sql, [companyId]);
  }

  /** -----------------------------------------------------------------------
   * ค้นหา timestamps พร้อมข้อมูลพนักงานและกะงาน
   */
  async findWithDetailsbyDate(companyId, date) {
    const sql = `
      SELECT 
        t.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        d.department_name,
        w.shift_name,
        w.check_in_time as scheduled_check_in,
        w.check_out_time as scheduled_check_out
      FROM ${this.tableName} t
      JOIN employees e ON e.id = t.employee_id
      LEFT JOIN department d ON d.id = e.department_id
      LEFT JOIN workingTime w ON w.id = t.working_time_id
      WHERE t.company_id = ? AND t.record_date = ?
      ORDER BY e.first_name ASC
    `;
    return this.query(sql, [companyId, date]);
  }

  /** -----------------------------------------------------------------------
   * บันทึก Check In
   */
  async recordCheckIn(data) {
    const {
      employee_id,
      company_id,
      working_time_id,
      check_in_time,
      check_in_type,
      check_in_location,
      check_in_device_id,
      is_late,
      late_minutes,
    } = data;

    const recordData = {
      company_id,
      employee_id,
      working_time_id,
      record_date: new Date().toISOString().split("T")[0],
      check_in_time,
      check_in_type: check_in_type || "device",
      check_in_location,
      check_in_device_id,
      is_late: is_late ? 1 : 0,
      late_minutes: late_minutes || 0,
      status: "active",
    };

    return this.create(recordData);
  }

  /** -----------------------------------------------------------------------
   * บันทึก Check Out
   */
  async recordCheckOut(recordId, data) {
    const {
      check_out_time,
      check_out_type,
      check_out_location,
      check_out_device_id,
      is_early_leave,
      early_leave_minutes,
      is_ot,
      ot_minutes,
    } = data;

    const sql = `
      UPDATE ${this.tableName}
      SET 
        check_out_time = ?,
        check_out_type = ?,
        check_out_location = ?,
        check_out_device_id = ?,
        is_early_leave = ?,
        early_leave_minutes = ?,
        is_ot = ?,
        ot_minutes = ?,
        updated_at = NOW()
      WHERE id = ?
    `;

    await this.pool.execute(sql, [
      check_out_time,
      check_out_type || "device",
      check_out_location,
      check_out_device_id,
      is_early_leave ? 1 : 0,
      early_leave_minutes || 0,
      is_ot ? 1 : 0,
      ot_minutes || 0,
      recordId,
    ]);

    return this.findById(recordId);
  }

  /** -----------------------------------------------------------------------
   * บันทึก Break
   */
  async recordBreak(recordId, breakStart, breakEnd = null) {
    const updates = { break_start_time: breakStart };
    if (breakEnd) {
      updates.break_end_time = breakEnd;
    }

    const sql = `
      UPDATE ${this.tableName}
      SET 
        break_start_time = ?,
        break_end_time = ?,
        updated_at = NOW()
      WHERE id = ?
    `;

    await this.pool.execute(sql, [breakStart, breakEnd, recordId]);
    return this.findById(recordId);
  }

  // ========================================
  // Statistics & Reports
  // ========================================

  /** -----------------------------------------------------------------------
   * สรุปสถิติการลงเวลาของพนักงานในเดือน
   */
  async getMonthlyStats(employeeId, year, month) {
    const sql = `
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as late_days,
        SUM(late_minutes) as total_late_minutes,
        SUM(CASE WHEN is_early_leave = 1 THEN 1 ELSE 0 END) as early_leave_days,
        SUM(early_leave_minutes) as total_early_leave_minutes,
        SUM(CASE WHEN is_ot = 1 THEN 1 ELSE 0 END) as ot_days,
        SUM(ot_minutes) as total_ot_minutes,
        SUM(TIMESTAMPDIFF(MINUTE, check_in_time, check_out_time)) as total_work_minutes
      FROM ${this.tableName}
      WHERE employee_id = ?
        AND YEAR(record_date) = ?
        AND MONTH(record_date) = ?
        AND check_out_time IS NOT NULL
    `;
    const rows = await this.query(sql, [employeeId, year, month]);
    return rows[0];
  }

  /** -----------------------------------------------------------------------
   * สรุปสถิติการลงเวลาของบริษัทวันนี้
   */
  async getTodayCompanyStats(companyId) {
    const sql = `
      SELECT 
        COUNT(DISTINCT employee_id) as checked_in_count,
        SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN check_out_time IS NOT NULL THEN 1 ELSE 0 END) as checked_out_count,
        (
          SELECT COUNT(*) 
          FROM employees 
          WHERE company_id = ? AND status = 'active'
        ) as total_active_employees
      FROM ${this.tableName}
      WHERE company_id = ? AND ${this.scopeToday()}
    `;
    const rows = await this.query(sql, [companyId, companyId]);
    const stats = rows[0];

    return {
      ...stats,
      not_checked_in_count:
        stats.total_active_employees - stats.checked_in_count,
      attendance_rate:
        stats.total_active_employees > 0
          ? Math.round(
              (stats.checked_in_count / stats.total_active_employees) * 100
            )
          : 0,
    };
  }

  /** -----------------------------------------------------------------------
   * ค้นหาพนักงานที่ยังไม่ลงเวลาเข้าวันนี้
   */
  async findNotCheckedInToday(companyId) {
    const sql = `
      SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        d.department_name
      FROM employees e
      LEFT JOIN department d ON d.id = e.department_id
      WHERE e.company_id = ? 
        AND e.status = 'active'
        AND e.id NOT IN (
          SELECT DISTINCT employee_id 
          FROM ${this.tableName}
          WHERE company_id = ? AND ${this.scopeToday()}
        )
      ORDER BY e.first_name ASC
    `;
    return this.query(sql, [companyId, companyId]);
  }

  /** -----------------------------------------------------------------------
   * ค้นหาพนักงานที่มาสายวันนี้
   */
  async findLateToday(companyId) {
    const sql = `
      SELECT 
        t.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.department_name
      FROM ${this.tableName} t
      JOIN employees e ON e.id = t.employee_id
      LEFT JOIN department d ON d.id = e.department_id
      WHERE t.company_id = ? 
        AND ${this.scopeToday()}
        AND t.is_late = 1
      ORDER BY t.late_minutes DESC
    `;
    return this.query(sql, [companyId]);
  }
}

module.exports = new TimestampRecordModel();
