const db = require("../../../config/db.config");

class RequestModel {
  async findAll(companyId, filters = {}, limit = 50, offset = 0) {
    let query = `
      SELECT
        r.id,
        r.company_id,
        r.employee_id,
        r.request_type,
        r.status,
        r.approver_id,
        r.target_date,
        r.roster_id,
        r.ot_template_id,
        r.request_data,
        r.rejected_reason,
        r.evidence_image,
        r.created_at,
        r.approved_at,
        emp.employee_code,
        emp.name AS employee_name,
        emp.image_url AS employee_avatar,
        appr.name AS approver_name,
        ot.name AS ot_template_name,
        ot.start_time AS ot_start_time,
        ot.end_time AS ot_end_time,
        ot.duration_hours AS ot_duration_hours,
        ot.overtime_rate AS ot_overtime_rate,
        fs.id AS from_shift_id,
        fs.name AS from_shift_name,
        fs.start_time AS from_shift_start_time,
        fs.end_time AS from_shift_end_time,
        ts.id AS to_shift_id,
        ts.name AS to_shift_name,
        ts.start_time AS to_shift_start_time,
        ts.end_time AS to_shift_end_time
      FROM requests r
      JOIN employees emp
        ON emp.id = r.employee_id
       AND emp.company_id = r.company_id
      LEFT JOIN employees appr
        ON appr.id = r.approver_id
       AND appr.company_id = r.company_id
      LEFT JOIN ot_templates ot
        ON ot.id = r.ot_template_id
       AND ot.company_id = r.company_id
      LEFT JOIN shifts fs
        ON fs.id = CAST(
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(r.request_data, '$.from_shift')),
            JSON_UNQUOTE(JSON_EXTRACT(r.request_data, '$.from_shift_id'))
          ) AS UNSIGNED
        )
       AND fs.company_id = r.company_id
       AND fs.deleted_at IS NULL
      LEFT JOIN shifts ts
        ON ts.id = CAST(
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(r.request_data, '$.to_shift')),
            JSON_UNQUOTE(JSON_EXTRACT(r.request_data, '$.to_shift_id'))
          ) AS UNSIGNED
        )
       AND ts.company_id = r.company_id
       AND ts.deleted_at IS NULL
      WHERE r.company_id = ?
    `;

    const params = [companyId];

    if (filters.employee_id) {
      query += " AND r.employee_id = ?";
      params.push(filters.employee_id);
    }

    if (Array.isArray(filters.status_list) && filters.status_list.length > 0) {
      if (filters.status_list.length === 1) {
        query += " AND r.status = ?";
        params.push(filters.status_list[0]);
      } else {
        const placeholders = filters.status_list.map(() => "?").join(", ");
        query += ` AND r.status IN (${placeholders})`;
        params.push(...filters.status_list);
      }
    }

    if (filters.request_type) {
      query += " AND r.request_type = ?";
      params.push(filters.request_type);
    }

    if (filters.target_date_from) {
      query += " AND r.target_date >= ?";
      params.push(filters.target_date_from);
    }

    if (filters.target_date_to) {
      query += " AND r.target_date <= ?";
      params.push(filters.target_date_to);
    }

    if (filters.search) {
      query += " AND (emp.name LIKE ? OR emp.employee_code LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += " ORDER BY r.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async countAll(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) AS total
      FROM requests r
      JOIN employees emp
        ON emp.id = r.employee_id
       AND emp.company_id = r.company_id
      WHERE r.company_id = ?
    `;

    const params = [companyId];

    if (filters.employee_id) {
      query += " AND r.employee_id = ?";
      params.push(filters.employee_id);
    }

    if (Array.isArray(filters.status_list) && filters.status_list.length > 0) {
      if (filters.status_list.length === 1) {
        query += " AND r.status = ?";
        params.push(filters.status_list[0]);
      } else {
        const placeholders = filters.status_list.map(() => "?").join(", ");
        query += ` AND r.status IN (${placeholders})`;
        params.push(...filters.status_list);
      }
    }

    if (filters.request_type) {
      query += " AND r.request_type = ?";
      params.push(filters.request_type);
    }

    if (filters.target_date_from) {
      query += " AND r.target_date >= ?";
      params.push(filters.target_date_from);
    }

    if (filters.target_date_to) {
      query += " AND r.target_date <= ?";
      params.push(filters.target_date_to);
    }

    if (filters.search) {
      query += " AND (emp.name LIKE ? OR emp.employee_code LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  async findById(id, companyId) {
    const query = `
      SELECT
        r.id,
        r.company_id,
        r.employee_id,
        r.request_type,
        r.status,
        r.approver_id,
        r.target_date,
        r.roster_id,
        r.ot_template_id,
        r.request_data,
        r.rejected_reason,
        r.evidence_image,
        r.created_at,
        r.approved_at,
        emp.employee_code,
        emp.name AS employee_name,
        emp.image_url AS employee_avatar,
        appr.name AS approver_name,
        ot.name AS ot_template_name,
        ot.start_time AS ot_start_time,
        ot.end_time AS ot_end_time,
        ot.duration_hours AS ot_duration_hours,
        ot.overtime_rate AS ot_overtime_rate,
        fs.id AS from_shift_id,
        fs.name AS from_shift_name,
        fs.start_time AS from_shift_start_time,
        fs.end_time AS from_shift_end_time,
        ts.id AS to_shift_id,
        ts.name AS to_shift_name,
        ts.start_time AS to_shift_start_time,
        ts.end_time AS to_shift_end_time
      FROM requests r
      JOIN employees emp
        ON emp.id = r.employee_id
       AND emp.company_id = r.company_id
      LEFT JOIN employees appr
        ON appr.id = r.approver_id
       AND appr.company_id = r.company_id
      LEFT JOIN ot_templates ot
        ON ot.id = r.ot_template_id
       AND ot.company_id = r.company_id
      LEFT JOIN shifts fs
        ON fs.id = CAST(
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(r.request_data, '$.from_shift')),
            JSON_UNQUOTE(JSON_EXTRACT(r.request_data, '$.from_shift_id'))
          ) AS UNSIGNED
        )
       AND fs.company_id = r.company_id
       AND fs.deleted_at IS NULL
      LEFT JOIN shifts ts
        ON ts.id = CAST(
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(r.request_data, '$.to_shift')),
            JSON_UNQUOTE(JSON_EXTRACT(r.request_data, '$.to_shift_id'))
          ) AS UNSIGNED
        )
       AND ts.company_id = r.company_id
       AND ts.deleted_at IS NULL
      WHERE r.id = ? AND r.company_id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async getStats(companyId) {
    const query = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
      FROM requests
      WHERE company_id = ?
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows[0];
  }
}

module.exports = new RequestModel();
