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
        ot.overtime_rate AS ot_overtime_rate
      FROM requests r
      JOIN employees emp ON emp.id = r.employee_id
      LEFT JOIN employees appr ON appr.id = r.approver_id
      LEFT JOIN ot_templates ot ON ot.id = r.ot_template_id
      WHERE r.company_id = ?
    `;

    const params = [companyId];

    if (filters.employee_id) {
      query += " AND r.employee_id = ?";
      params.push(filters.employee_id);
    }

    if (filters.status) {
      query += " AND r.status = ?";
      params.push(filters.status);
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
      JOIN employees emp ON emp.id = r.employee_id
      WHERE r.company_id = ?
    `;

    const params = [companyId];

    if (filters.employee_id) {
      query += " AND r.employee_id = ?";
      params.push(filters.employee_id);
    }

    if (filters.status) {
      query += " AND r.status = ?";
      params.push(filters.status);
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
        ot.overtime_rate AS ot_overtime_rate
      FROM requests r
      JOIN employees emp ON emp.id = r.employee_id
      LEFT JOIN employees appr ON appr.id = r.approver_id
      LEFT JOIN ot_templates ot ON ot.id = r.ot_template_id
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
