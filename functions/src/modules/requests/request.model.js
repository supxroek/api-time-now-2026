const db = require("../../config/db.config");

// Request Model
class RequestModel {
  // ==============================================================
  // ดึงคำขอทั้งหมด
  async findAll(companyId, filters = {}, limit = 50, offset = 0) {
    // Specify columns to avoid collision (e.g., id, status, created_at)
    let query = `
    SELECT
    r.id,
    r.company_id,
    r.employee_id,
    r.request_type,
    r.status,
    r.approver_id,
    r.request_data,
    r.rejected_reason,
    r.evidence_image,
    r.created_at,
    r.approved_at,
    e.employee_code,
    e.name AS employee_name,
    e.image_url AS employee_avatar,
    ap.name AS approver_name,

    -- รายละเอียด OT Template
    ot.name AS ot_template_name,
    ot.overtime_rate AS ot_rate,
    ot.duration_hours AS ot_duration,
    ot.start_time AS ot_start_time,
    ot.end_time AS ot_end_time,

    -- รายละเอียดกะงานเดิม (Original Shift) - สำหรับ Shift Swap
    s_orig.name AS original_shift_name,
    s_orig.start_time AS original_shift_start,
    s_orig.end_time AS original_shift_end,

    -- รายละเอียดกะงานใหม่ (Target Shift) - สำหรับ Shift Swap หรือ Correction
    s_target.name AS target_shift_name,
    s_target.start_time AS target_shift_start,
    s_target.end_time AS target_shift_end

    FROM requests r
    JOIN employees e ON r.employee_id = e.id
    LEFT JOIN employees ap ON r.approver_id = ap.id

    -- JOIN OT Templates
    LEFT JOIN ot_templates ot ON
      r.request_type = 'ot' AND
      ot.id = CAST(r.request_data->>'$.ot_template_id' AS UNSIGNED)

    -- JOIN กะงานเดิม (Original) โดยดึง original_shift_id จาก JSON
    LEFT JOIN shifts s_orig ON
      r.request_type = 'shift_swap' AND
      s_orig.id = CAST(r.request_data->>'$.original_shift_id' AS UNSIGNED)

    -- JOIN กะงานใหม่ (Target) โดยดึง target_shift_id หรือ shift_id จาก JSON
    LEFT JOIN shifts s_target ON
      (r.request_type = 'shift_swap' OR r.request_type = 'correction') AND
      s_target.id = CAST(COALESCE(r.request_data->>'$.target_shift_id', r.request_data->>'$.shift_id') AS UNSIGNED)

    WHERE r.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += ` AND r.employee_id = ?`;
      params.push(filters.employee_id);
    }

    if (filters.status) {
      if (typeof filters.status === "string" && filters.status.includes(",")) {
        const statuses = filters.status.split(",").map((s) => s.trim());
        query += ` AND r.status IN (${statuses.map(() => "?").join(",")})`;
        params.push(...statuses);
      } else {
        query += ` AND r.status = ?`;
        params.push(filters.status);
      }
    }

    if (filters.request_type) {
      query += ` AND r.request_type = ?`;
      params.push(filters.request_type);
    }

    if (filters.search) {
      query += ` AND (e.name LIKE ? OR e.employee_code LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // สรุปสถิติ
  async getStats(companyId) {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM requests
      WHERE company_id = ?
    `;
    const [rows] = await db.query(query, [companyId]);
    return rows[0];
  }

  // ==============================================================
  // นับจำนวนคำขอทั้งหมด
  async countAll(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) as total
      FROM requests r
      JOIN employees e ON r.employee_id = e.id
      WHERE r.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += ` AND r.employee_id = ?`;
      params.push(filters.employee_id);
    }

    if (filters.status) {
      if (typeof filters.status === "string" && filters.status.includes(",")) {
        const statuses = filters.status.split(",").map((s) => s.trim());
        query += ` AND r.status IN (${statuses.map(() => "?").join(",")})`;
        params.push(...statuses);
      } else {
        query += ` AND r.status = ?`;
        params.push(filters.status);
      }
    }

    if (filters.request_type) {
      query += ` AND r.request_type = ?`;
      params.push(filters.request_type);
    }

    if (filters.search) {
      query += ` AND (e.name LIKE ? OR e.employee_code LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }
}

module.exports = new RequestModel();
