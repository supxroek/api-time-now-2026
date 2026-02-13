const db = require("../../config/db.config");

// Audit Trail Model
class AuditTrailModel {
  // ==============================================================
  // ดึงข้อมูล Audit Logs ทั้งหมด
  async findAll(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `
      SELECT 
        at.*,
        u.email as user_email,
        u.role as user_role,
        e.name as user_name
      FROM audit_trail at
      LEFT JOIN users u ON at.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE at.company_id = ?
    `;
    const params = [companyId];

    if (filters.action_type) {
      query += ` AND at.action_type = ?`;
      params.push(filters.action_type);
    }

    if (filters.table_name) {
      query += ` AND at.table_name = ?`;
      params.push(filters.table_name);
    }

    if (filters.user_id) {
      query += ` AND at.user_id = ?`;
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      query += ` AND DATE(at.created_at) >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND DATE(at.created_at) <= ?`;
      params.push(filters.end_date);
    }

    // Search by old_values or new_values (optional, might be slow on large data)
    if (filters.search) {
      query += ` AND (
        at.old_values LIKE ? OR 
        at.new_values LIKE ? OR
        u.email LIKE ? OR
        e.name LIKE ?
      )`;
      const searchParam = `%${filters.search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    query += ` ORDER BY at.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวน Audit Logs ทั้งหมด (สำหรับ Pagination)
  async countAll(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) as total 
      FROM audit_trail at
      LEFT JOIN users u ON at.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE at.company_id = ?
    `;
    const params = [companyId];

    if (filters.action_type) {
      query += ` AND at.action_type = ?`;
      params.push(filters.action_type);
    }

    if (filters.table_name) {
      query += ` AND at.table_name = ?`;
      params.push(filters.table_name);
    }

    if (filters.user_id) {
      query += ` AND at.user_id = ?`;
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      query += ` AND DATE(at.created_at) >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND DATE(at.created_at) <= ?`;
      params.push(filters.end_date);
    }

    if (filters.search) {
      query += ` AND (
        at.old_values LIKE ? OR 
        at.new_values LIKE ? OR
        u.email LIKE ? OR
        e.name LIKE ?
      )`;
      const searchParam = `%${filters.search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงข้อมูล Audit Log ตาม ID
  async findById(id, companyId) {
    const query = `
      SELECT 
        at.*,
        u.email as user_email,
        u.role as user_role,
        e.name as user_name
      FROM audit_trail at
      LEFT JOIN users u ON at.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE at.id = ? AND at.company_id = ?
    `;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงสถิติการกระทำต่างๆ (INSERT, UPDATE, DELETE) สำหรับ Dashboard
  async getStats(companyId) {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN action_type = 'INSERT' THEN 1 ELSE 0 END) as inserts,
        SUM(CASE WHEN action_type = 'UPDATE' THEN 1 ELSE 0 END) as updates,
        SUM(CASE WHEN action_type = 'DELETE' THEN 1 ELSE 0 END) as deletes
      FROM audit_trail
      WHERE company_id = ?
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows[0];
  }
}

module.exports = new AuditTrailModel();
