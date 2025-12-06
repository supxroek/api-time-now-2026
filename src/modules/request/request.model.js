const pool = require("../../config/database");

// Model Class
class RequestModel {
  // ======== Helper Methods =========

  /**
   * สร้าง request_id แบบ unique (REQ-YYYYMMDD-XXXX)
   */
  _generateRequestId() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replaceAll("-", "");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
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
  async createForgetTimeRequest(employeeId, companyId, requestData) {
    const { timestamp_type, forget_date, forget_time, reason, evidence } =
      requestData;
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
   * อนุมัติคำขอตาม ID
   */
  async approveRequest(requestId, companyId) {
    const query = `
      UPDATE forget_timestamp_requests 
      SET status = 'approved', approved_at = NOW()
      WHERE id = ? AND company_id = ? AND status = 'pending'`;
    const [result] = await pool.execute(query, [requestId, companyId]);
    return result.affectedRows > 0;
  }

  /**
   * ปฏิเสธคำขอตาม ID
   */
  async rejectRequest(requestId, companyId) {
    const query = `
      UPDATE forget_timestamp_requests 
      SET status = 'rejected', approved_at = NOW()
      WHERE id = ? AND company_id = ? AND status = 'pending'`;
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
    const query = `
      INSERT INTO timestamp_records (employeeid, companyId, workingTimeId, created_at)
      VALUES (?, ?, ?, ?)`;
    const [result] = await pool.execute(query, [
      employeeId,
      companyId,
      workingTimeId || 0,
      `${forgetDate} 00:00:00`,
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
