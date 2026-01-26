const db = require("../../config/db.config");

// Request Model
class RequestModel {
  // ==============================================================
  // ดึงคำขอทั้งหมด
  async findAll(companyId, filters = {}, limit = 50, offset = 0) {
    let query = `
      SELECT r.*, e.*, e.name as employee_name, ap.name as approver_name
      FROM requests r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN employees ap ON r.approver_id = ap.id
      WHERE r.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += ` AND r.employee_id = ?`;
      params.push(filters.employee_id);
    }

    if (filters.status) {
      query += ` AND r.status = ?`;
      params.push(filters.status);
    }

    if (filters.request_type) {
      query += ` AND r.request_type = ?`;
      params.push(filters.request_type);
    }

    if (filters.start_date) {
      query += ` AND DATE(r.created_at) >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND DATE(r.created_at) <= ?`;
      params.push(filters.end_date);
    }

    query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
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
      query += ` AND r.status = ?`;
      params.push(filters.status);
    }

    if (filters.request_type) {
      query += ` AND r.request_type = ?`;
      params.push(filters.request_type);
    }

    if (filters.start_date) {
      query += ` AND DATE(r.created_at) >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND DATE(r.created_at) <= ?`;
      params.push(filters.end_date);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }
}

module.exports = new RequestModel();
