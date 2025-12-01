/**
 * /api/models/request.model.js
 *
 * ForgetTimestampRequest Model - Operation & Logging Domain
 * คำร้องขอแก้เวลา/ลืมลงเวลา
 *
 * Relationships:
 *   - belongsTo -> Employee, Company
 */

const BaseModel = require("./base.model");

// Enum สำหรับ Status
const REQUEST_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
};

// Enum สำหรับ Request Type
const REQUEST_TYPE = {
  FORGET_CHECK_IN: "forget_check_in",
  FORGET_CHECK_OUT: "forget_check_out",
  WRONG_TIME: "wrong_time",
  DEVICE_ERROR: "device_error",
  OTHER: "other",
};

class ForgetTimestampRequestModel extends BaseModel {
  constructor() {
    super(
      "forget_timestamp_requests", // tableName
      "id", // primaryKey
      [], // hiddenFields
      [
        // fillable fields
        "company_id",
        "employee_id",
        "request_type",
        "request_date",
        "original_check_in",
        "original_check_out",
        "requested_check_in",
        "requested_check_out",
        "reason",
        "supporting_document_url",
        "status",
        "approved_by",
        "approved_at",
        "rejection_reason",
        "notes",
      ]
    );

    // Export enums
    this.STATUS = REQUEST_STATUS;
    this.TYPE = REQUEST_TYPE;
  }

  // ========================================
  // Custom Queries
  // ========================================

  /** -----------------------------------------------------------------------
   * ค้นหาคำร้องที่รอดำเนินการ (สำหรับแจ้งเตือน HR)
   */
  async findPending(companyId) {
    const sql = `
      SELECT 
        r.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        d.department_name
      FROM ${this.tableName} r
      JOIN employees e ON e.id = r.employee_id
      LEFT JOIN department d ON d.id = e.department_id
      WHERE r.company_id = ? AND r.status = ?
      ORDER BY r.created_at ASC
    `;
    return this.query(sql, [companyId, REQUEST_STATUS.PENDING]);
  }

  /** -----------------------------------------------------------------------
   * นับจำนวนคำร้องที่รอดำเนินการ
   */
  async countPending(companyId) {
    return this.count({
      company_id: companyId,
      status: REQUEST_STATUS.PENDING,
    });
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่ามีคำร้องที่รอดำเนินการหรือไม่
   */
  async hasPendingRequests(companyId) {
    const count = await this.countPending(companyId);
    return count > 0;
  }

  /** -----------------------------------------------------------------------
   * ค้นหาคำร้องของพนักงาน
   */
  async findByEmployee(employeeId, options = {}) {
    const { status = null, limit = 50 } = options;

    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE employee_id = ?
    `;
    const params = [employeeId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    return this.query(sql, params);
  }

  /** -----------------------------------------------------------------------
   * ค้นหาคำร้องของพนักงานในวันที่ระบุ
   */
  async findByEmployeeAndDate(employeeId, date) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE employee_id = ? AND request_date = ?
      ORDER BY created_at DESC
    `;
    return this.query(sql, [employeeId, date]);
  }

  /** -----------------------------------------------------------------------
   * ค้นหาคำร้องพร้อมรายละเอียด
   */
  async findWithDetails(requestId) {
    const sql = `
      SELECT 
        r.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        d.department_name,
        approver.first_name as approver_first_name,
        approver.last_name as approver_last_name
      FROM ${this.tableName} r
      JOIN employees e ON e.id = r.employee_id
      LEFT JOIN department d ON d.id = e.department_id
      LEFT JOIN employees approver ON approver.id = r.approved_by
      WHERE r.id = ?
    `;
    const rows = await this.query(sql, [requestId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /** -----------------------------------------------------------------------
   * อนุมัติคำร้อง
   * @param {number} requestId
   * @param {number} approverId - ID ของผู้อนุมัติ
   * @param {string} notes - หมายเหตุ (optional)
   * @returns {Promise<Object>}
   */
  async approve(requestId, approverId, notes = null) {
    const sql = `
      UPDATE ${this.tableName}
      SET 
        status = ?,
        approved_by = ?,
        approved_at = NOW(),
        notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    await this.pool.execute(sql, [
      REQUEST_STATUS.APPROVED,
      approverId,
      notes,
      requestId,
    ]);
    return this.findById(requestId);
  }

  /** -----------------------------------------------------------------------
   * ปฏิเสธคำร้อง
   */
  async reject(requestId, approverId, rejectionReason) {
    const sql = `
      UPDATE ${this.tableName}
      SET 
        status = ?,
        approved_by = ?,
        approved_at = NOW(),
        rejection_reason = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    await this.pool.execute(sql, [
      REQUEST_STATUS.REJECTED,
      approverId,
      rejectionReason,
      requestId,
    ]);
    return this.findById(requestId);
  }

  /** -----------------------------------------------------------------------
   * ยกเลิกคำร้อง (โดยพนักงานเอง)
   */
  async cancel(requestId) {
    const sql = `
      UPDATE ${this.tableName}
      SET 
        status = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    await this.pool.execute(sql, [REQUEST_STATUS.CANCELLED, requestId]);
    return this.findById(requestId);
  }

  /** -----------------------------------------------------------------------
   * สร้างคำร้องใหม่
   */
  async createRequest(data) {
    const requestData = {
      ...data,
      status: REQUEST_STATUS.PENDING,
      request_date: data.request_date || new Date().toISOString().split("T")[0],
    };
    return this.create(requestData);
  }

  /** -----------------------------------------------------------------------
   * ค้นหาคำร้องตามช่วงวันที่
   */
  async findByDateRange(companyId, startDate, endDate, status = null) {
    let sql = `
      SELECT 
        r.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.department_name
      FROM ${this.tableName} r
      JOIN employees e ON e.id = r.employee_id
      LEFT JOIN department d ON d.id = e.department_id
      WHERE r.company_id = ?
        AND r.request_date BETWEEN ? AND ?
    `;
    const params = [companyId, startDate, endDate];

    if (status) {
      sql += ` AND r.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY r.created_at DESC`;

    return this.query(sql, params);
  }

  /** -----------------------------------------------------------------------
   * สถิติคำร้องรายเดือน
   */
  async getMonthlyStats(companyId, year, month) {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
      FROM ${this.tableName}
      WHERE company_id = ?
        AND YEAR(request_date) = ?
        AND MONTH(request_date) = ?
    `;
    const rows = await this.query(sql, [companyId, year, month]);
    return rows[0];
  }
}

module.exports = new ForgetTimestampRequestModel();
