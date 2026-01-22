const pool = require("../../config/database");
const { randomInt } = require("node:crypto");

// Model Class
class RequestModel {
  // ======== Helper Methods =========

  /**
   * สร้าง request_id แบบ unique (REQ-YYYYMMDD-XXXX)
   */
  _generateRequestId() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replaceAll("-", "");
    const random = randomInt(0, Math.pow(36, 4))
      .toString(36)
      .padStart(4, "0")
      .toUpperCase();
    return `REQ-${dateStr}-${random}`;
  }

  // ======== Employee Side (คนขอ) =========

  /**
   * ค้นหาคำขอของพนักงานโดยใช้ employeeId และ companyId
   */
  async findByEmployeeId(employeeId, companyId) {
    const query = `
      SELECT 
        r.id, r.request_id, r.employee_id, r.company_id,
        r.timestamp_type, r.forget_date, r.forget_time,
        r.reason, r.evidence, r.status,
        r.created_at, r.approved_at,
        e.name as employee_name
      FROM forget_timestamp_requests r
      LEFT JOIN employees e ON r.employee_id = e.id
      WHERE r.employee_id = ? AND r.company_id = ?
      ORDER BY r.created_at DESC`;
    const [rows] = await pool.execute(query, [employeeId, companyId]);
    return rows;
  }

  /**
   * ตรวจสอบคำขอซ้ำกัน (สถานะ pending)
   */
  async checkDuplicateRequest(
    employeeId,
    companyId,
    timestampType,
    forgetDate,
    forgetTime
  ) {
    const query = `
      SELECT id FROM forget_timestamp_requests 
      WHERE employee_id = ? 
        AND company_id = ? 
        AND timestamp_type = ? 
        AND forget_date = ? 
        AND forget_time = ? 
        AND status = 'pending'
      LIMIT 1`;
    const [rows] = await pool.execute(query, [
      employeeId,
      companyId,
      timestampType,
      forgetDate,
      forgetTime,
    ]);
    return rows.length > 0;
  }

  /**
   * สร้างคำขอลืมบันทึกเวลา
   */
  async createForgetTimeRequest(companyId, requestData) {
    const {
      employeeId,
      timestamp_type,
      forget_date,
      forget_time,
      reason,
      evidence,
    } = requestData;
    const request_id = this._generateRequestId();

    const query = `
      INSERT INTO forget_timestamp_requests 
        (request_id, employee_id, company_id, timestamp_type, forget_date, forget_time, reason, evidence, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`;

    const [result] = await pool.execute(query, [
      request_id,
      employeeId,
      companyId,
      timestamp_type,
      forget_date,
      forget_time,
      reason,
      evidence || null,
    ]);

    return {
      id: result.insertId,
      request_id,
      employee_id: employeeId,
      company_id: companyId,
      timestamp_type,
      forget_date,
      forget_time,
      reason,
      evidence: evidence || null,
      status: "pending",
    };
  }

  // ======== Admin Side (ผู้อนุมัติ) =========

  /**
   * ค้นหาคำขอที่รอการอนุมัติโดยใช้ companyId
   */
  async findPendingRequests(companyId) {
    const query = `
      SELECT 
        r.id, r.request_id, r.employee_id, r.company_id,
        r.timestamp_type, r.forget_date, r.forget_time,
        r.reason, r.evidence, r.status,
        r.created_at, r.approved_at,
        e.name as employee_name,
        d.departmentName as department_name
      FROM forget_timestamp_requests r
      LEFT JOIN employees e ON r.employee_id = e.id
      LEFT JOIN department d ON e.departmentId = d.id
      WHERE r.company_id = ? AND r.status = 'pending'
      ORDER BY r.created_at ASC`;
    const [rows] = await pool.execute(query, [companyId]);
    return rows;
  }

  /**
   * ค้นหาประวัติคำขอ (Approved/Rejected) พร้อมตัวกรอง
   */
  async findRequestHistory(companyId, filters = {}) {
    let query = `
      SELECT 
        r.id, r.request_id, r.employee_id, r.company_id,
        r.timestamp_type, r.forget_date, r.forget_time,
        r.reason, r.evidence, r.status,
        r.created_at, r.approved_at,
        e.name as employee_name,
        d.departmentName as department_name
      FROM forget_timestamp_requests r
      LEFT JOIN employees e ON r.employee_id = e.id
      LEFT JOIN department d ON e.departmentId = d.id
      WHERE r.company_id = ? AND r.status IN ('approved', 'rejected')`;

    const params = [Number.parseInt(companyId)];

    if (filters.startDate) {
      query += ` AND DATE(r.created_at) >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND DATE(r.created_at) <= ?`;
      params.push(filters.endDate);
    }

    if (filters.status && filters.status !== "all") {
      query += ` AND r.status = ?`;
      params.push(filters.status);
    }

    if (filters.type && filters.type !== "all") {
      query += ` AND r.timestamp_type = ?`;
      params.push(filters.type);
    }

    if (filters.search) {
      query += ` AND (e.name LIKE ? OR r.request_id LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY r.created_at DESC`;

    // Safe pagination
    let limit = 10;
    let offset = 0;

    if (filters.limit) {
      const parsedLimit = Number.parseInt(filters.limit, 10);
      if (!Number.isNaN(parsedLimit) && parsedLimit > 0) limit = parsedLimit;
    }

    if (filters.page) {
      const parsedPage = Number.parseInt(filters.page, 10);
      if (!Number.isNaN(parsedPage) && parsedPage > 0) {
        offset = (parsedPage - 1) * limit;
      }
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * นับจำนวนประวัติคำขอสำหรับ Pagination
   */
  async countRequestHistory(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) as total
      FROM forget_timestamp_requests r
      LEFT JOIN employees e ON r.employee_id = e.id
      WHERE r.company_id = ? AND r.status IN ('approved', 'rejected')`;

    const params = [Number.parseInt(companyId)];

    if (filters.startDate) {
      query += ` AND DATE(r.created_at) >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND DATE(r.created_at) <= ?`;
      params.push(filters.endDate);
    }

    if (filters.status && filters.status !== "all") {
      query += ` AND r.status = ?`;
      params.push(filters.status);
    }

    if (filters.type && filters.type !== "all") {
      query += ` AND r.timestamp_type = ?`;
      params.push(filters.type);
    }

    if (filters.search) {
      query += ` AND (e.name LIKE ? OR r.request_id LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const [rows] = await pool.query(query, params);
    return rows[0].total;
  }

  /**
   * ดึงสถิติคำขอ (Pending, Approved, Rejected, Total History)
   */
  async getRequestStats(companyId) {
    const query = `
      SELECT 
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        COUNT(*) as total
      FROM forget_timestamp_requests
      WHERE company_id = ?`;

    const [rows] = await pool.execute(query, [Number.parseInt(companyId)]);
    return {
      pending: Number.parseInt(rows[0].pending || 0),
      approved: Number.parseInt(rows[0].approved || 0),
      rejected: Number.parseInt(rows[0].rejected || 0),
      total: Number.parseInt(rows[0].total || 0),
    };
  }

  /**
   * ค้นหาคำขอตาม ID
   */
  async findById(requestId, companyId) {
    const query = `
      SELECT * FROM forget_timestamp_requests 
      WHERE id = ? AND company_id = ?`;
    const [rows] = await pool.execute(query, [requestId, companyId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * ค้นหาคำขอตาม Request ID (String)
   */
  async findByRequestId(requestId, companyId) {
    const query = `
      SELECT * FROM forget_timestamp_requests 
      WHERE request_id = ? AND company_id = ?`;
    const [rows] = await pool.execute(query, [requestId, companyId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * อนุมัติคำขอตาม Request ID
   */
  async approveRequest(requestId, companyId) {
    const query = `
      UPDATE forget_timestamp_requests 
      SET status = 'approved', approved_at = NOW()
      WHERE request_id = ? AND company_id = ? AND status = 'pending'`;
    const [result] = await pool.execute(query, [requestId, companyId]);
    return result.affectedRows > 0;
  }

  /**
   * ปฏิเสธคำขอตาม Request ID
   */
  async rejectRequest(requestId, companyId) {
    const query = `
      UPDATE forget_timestamp_requests 
      SET status = 'rejected', approved_at = NOW()
      WHERE request_id = ? AND company_id = ? AND status = 'pending'`;
    const [result] = await pool.execute(query, [requestId, companyId]);
    return result.affectedRows > 0;
  }

  // ======== Timestamp Records Methods =========

  /**
   * ค้นหา timestamp record ของวันที่ร้องขอ
   */
  async findTimestampRecord(employeeId, companyId, forgetDate) {
    const query = `
      SELECT * FROM timestamp_records 
      WHERE employeeid = ? AND companyId = ? AND DATE(created_at) = ?
      LIMIT 1`;
    const [rows] = await pool.execute(query, [
      employeeId,
      companyId,
      forgetDate,
    ]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * สร้าง timestamp record ใหม่ (กรณีไม่มี record ของวันนั้น)
   */
  async createTimestampRecord(
    employeeId,
    companyId,
    forgetDate,
    workingTimeId
  ) {
    // Ensure forgetDate is in YYYY-MM-DD format
    let formattedDate = forgetDate;
    if (forgetDate instanceof Date) {
      formattedDate = forgetDate.toISOString().split("T")[0];
    } else if (typeof forgetDate === "string" && forgetDate.includes("T")) {
      formattedDate = forgetDate.split("T")[0];
    }

    const query = `
      INSERT INTO timestamp_records (employeeid, companyId, workingTimeId, created_at)
      VALUES (?, ?, ?, ?)`;
    const [result] = await pool.execute(query, [
      employeeId,
      companyId,
      workingTimeId || 0,
      `${formattedDate} 00:00:00`,
    ]);
    return result.insertId;
  }

  /**
   * อัปเดต timestamp record ตามประเภทของคำขอ
   */
  async updateTimestampRecord(recordId, timestampType, forgetTime) {
    // Mapping timestamp_type -> column name
    const columnMap = {
      work_in: "start_time",
      work_out: "end_time",
      break_in: "break_start_time",
      break_out: "break_end_time",
      ot_in: "ot_start_time",
      ot_out: "ot_end_time",
    };

    const column = columnMap[timestampType];
    if (!column) {
      throw new Error(`Invalid timestamp_type: ${timestampType}`);
    }

    // ถ้าเป็น OT ให้ set otStatus = 1 ด้วย
    let query;
    let params;

    if (timestampType === "ot_in" || timestampType === "ot_out") {
      query = `UPDATE timestamp_records SET ${column} = ?, otStatus = 1 WHERE id = ?`;
      params = [forgetTime, recordId];
    } else {
      query = `UPDATE timestamp_records SET ${column} = ? WHERE id = ?`;
      params = [forgetTime, recordId];
    }

    const [result] = await pool.execute(query, params);
    return result.affectedRows > 0;
  }

  /**
   * ค้นหา workingTime (กะงาน) ของพนักงาน
   */
  async findEmployeeWorkingTime(employeeId, companyId) {
    const query = `
      SELECT id FROM workingTime 
      WHERE companyId = ? AND JSON_CONTAINS(employeeId, CAST(? AS JSON))
      LIMIT 1`;
    const [rows] = await pool.execute(query, [companyId, employeeId]);
    return rows.length > 0 ? rows[0].id : null;
  }

  /**
   * ดึงคำขอทั้งหมดของบริษัท (กรองตาม status)
   */
  async findAllByCompany(companyId, status = null) {
    let query = `
      SELECT 
        r.id, r.request_id, r.employee_id, r.company_id,
        r.timestamp_type, r.forget_date, r.forget_time,
        r.reason, r.evidence, r.status,
        r.created_at, r.approved_at,
        e.name as employee_name
      FROM forget_timestamp_requests r
      LEFT JOIN employees e ON r.employee_id = e.id
      WHERE r.company_id = ?`;

    const params = [companyId];

    if (status) {
      query += " AND r.status = ?";
      params.push(status);
    }

    query += " ORDER BY r.created_at DESC";

    const [rows] = await pool.execute(query, params);
    return rows;
  }
}

module.exports = new RequestModel();
