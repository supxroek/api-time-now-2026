const db = require("../../config/db.config");

class PublicHolidayModel {
  // ==============================================================
  // Create Public Holiday
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO public_holidays (${keys.join(", ")}) VALUES (${placeholders})`;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  // ==============================================================
  // Find All (with Year filter optional)
  async findAll(companyId, filters = {}, limit = 50, offset = 0) {
    let query = `SELECT * FROM public_holidays WHERE company_id = ?`;
    const params = [companyId];

    if (filters.year) {
      query += ` AND YEAR(holiday_date) = ?`;
      params.push(filters.year);
    }

    if (filters.month) {
      query += ` AND MONTH(holiday_date) = ?`;
      params.push(filters.month);
    }

    if (filters.search) {
      query += ` AND name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    query += ` ORDER BY holiday_date ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // Count All
  async countAll(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM public_holidays WHERE company_id = ?`;
    const params = [companyId];

    if (filters.year) {
      query += ` AND YEAR(holiday_date) = ?`;
      params.push(filters.year);
    }

    if (filters.month) {
      query += ` AND MONTH(holiday_date) = ?`;
      params.push(filters.month);
    }

    if (filters.search) {
      query += ` AND name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // Find By ID
  async findById(id, companyId) {
    const query = `SELECT * FROM public_holidays WHERE id = ? AND company_id = ?`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // Check Duplicate Date
  async findByDate(date, companyId) {
    const query = `SELECT * FROM public_holidays WHERE holiday_date = ? AND company_id = ?`;
    const [rows] = await db.query(query, [date, companyId]);
    return rows[0];
  }

  // ==============================================================
  // Update
  async update(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `UPDATE public_holidays SET ${setClause} WHERE id = ? AND company_id = ?`;
    await db.query(query, [...values, id, companyId]);
  }

  // ==============================================================
  // Delete (Hard Delete)
  async delete(id, companyId) {
    const query = `DELETE FROM public_holidays WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new PublicHolidayModel();
