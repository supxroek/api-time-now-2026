const db = require("../../../config/db.config");

class AuditTrailModel {
  async findAll(companyId, filters = {}, limit = 50, offset = 0) {
    let query = `
      SELECT
        at.id,
        at.company_id,
        at.user_id,
        at.action_type,
        at.table_name,
        at.record_id,
        at.old_values,
        at.new_values,
        at.ip_address,
        at.created_at,
        u.email AS user_email,
        u.role AS user_role,
        e.id AS user_employee_id,
        e.name AS user_name
      FROM audit_trail at
      LEFT JOIN users u ON u.id = at.user_id
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE at.company_id = ?
    `;

    const params = [companyId];

    if (filters.action_type) {
      query += " AND at.action_type = ?";
      params.push(filters.action_type);
    }

    if (filters.table_name) {
      query += " AND at.table_name = ?";
      params.push(filters.table_name);
    }

    if (filters.user_id) {
      query += " AND at.user_id = ?";
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      query += " AND DATE(at.created_at) >= ?";
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += " AND DATE(at.created_at) <= ?";
      params.push(filters.end_date);
    }

    if (filters.search) {
      query += `
        AND (
          e.name LIKE ?
          OR u.email LIKE ?
          OR at.table_name LIKE ?
          OR CAST(at.record_id AS CHAR) LIKE ?
          OR at.old_values LIKE ?
          OR at.new_values LIKE ?
        )
      `;

      const searchTerm = `%${filters.search}%`;
      params.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      );
    }

    query += " ORDER BY at.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async countAll(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) AS total
      FROM audit_trail at
      LEFT JOIN users u ON u.id = at.user_id
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE at.company_id = ?
    `;

    const params = [companyId];

    if (filters.action_type) {
      query += " AND at.action_type = ?";
      params.push(filters.action_type);
    }

    if (filters.table_name) {
      query += " AND at.table_name = ?";
      params.push(filters.table_name);
    }

    if (filters.user_id) {
      query += " AND at.user_id = ?";
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      query += " AND DATE(at.created_at) >= ?";
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += " AND DATE(at.created_at) <= ?";
      params.push(filters.end_date);
    }

    if (filters.search) {
      query += `
        AND (
          e.name LIKE ?
          OR u.email LIKE ?
          OR at.table_name LIKE ?
          OR CAST(at.record_id AS CHAR) LIKE ?
          OR at.old_values LIKE ?
          OR at.new_values LIKE ?
        )
      `;

      const searchTerm = `%${filters.search}%`;
      params.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      );
    }

    const [rows] = await db.query(query, params);
    return rows[0]?.total || 0;
  }

  async findById(id, companyId) {
    const query = `
      SELECT
        at.id,
        at.company_id,
        at.user_id,
        at.action_type,
        at.table_name,
        at.record_id,
        at.old_values,
        at.new_values,
        at.ip_address,
        at.created_at,
        u.email AS user_email,
        u.role AS user_role,
        e.id AS user_employee_id,
        e.name AS user_name
      FROM audit_trail at
      LEFT JOIN users u ON u.id = at.user_id
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE at.id = ? AND at.company_id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async getStats(companyId) {
    const query = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN action_type = 'INSERT' THEN 1 ELSE 0 END) AS inserts,
        SUM(CASE WHEN action_type = 'UPDATE' THEN 1 ELSE 0 END) AS updates,
        SUM(CASE WHEN action_type = 'DELETE' THEN 1 ELSE 0 END) AS deletes
      FROM audit_trail
      WHERE company_id = ?
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows[0] || { total: 0, inserts: 0, updates: 0, deletes: 0 };
  }
}

module.exports = new AuditTrailModel();
