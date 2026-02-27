const db = require("../../../config/db.config");

class EmployeeModel {
  async findAllByCompanyId(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `
      SELECT
        id,
        company_id,
        employee_code,
        department_id,
        name,
        email,
        image_url,
        phone_number,
        id_or_passport_number,
        line_user_id,
        start_date,
        resign_date,
        status,
        created_at,
        deleted_at
      FROM employees
      WHERE company_id = ?
        AND deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ? OR employee_code LIKE ? OR email LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    if (filters.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }

    if (filters.department_id) {
      query += " AND department_id = ?";
      params.push(filters.department_id);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async countAllByCompanyId(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) AS total
      FROM employees
      WHERE company_id = ?
        AND deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ? OR employee_code LIKE ? OR email LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    if (filters.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }

    if (filters.department_id) {
      query += " AND department_id = ?";
      params.push(filters.department_id);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  async findByIdAndCompanyId(id, companyId) {
    const query = `
      SELECT
        id,
        company_id,
        employee_code,
        department_id,
        name,
        email,
        image_url,
        phone_number,
        id_or_passport_number,
        line_user_id,
        start_date,
        resign_date,
        status,
        created_at,
        deleted_at
      FROM employees
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;

    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async findDuplicateUniqueFields(companyId, data, excludeEmployeeId = null) {
    const fields = [
      "email",
      "id_or_passport_number",
      "line_user_id",
      "employee_code",
    ];
    const conditions = [];
    const params = [];

    fields.forEach((field) => {
      if (
        data[field] !== undefined &&
        data[field] !== null &&
        data[field] !== ""
      ) {
        conditions.push(`${field} = ?`);
        params.push(data[field]);
      }
    });

    if (!conditions.length) {
      return null;
    }

    let query = `
      SELECT id, email, id_or_passport_number, line_user_id, employee_code
      FROM employees
      WHERE company_id = ?
        AND deleted_at IS NULL
        AND (${conditions.join(" OR ")})
    `;

    const allParams = [companyId, ...params];
    if (excludeEmployeeId) {
      query += " AND id <> ?";
      allParams.push(excludeEmployeeId);
    }

    query += " LIMIT 1";
    const [rows] = await db.query(query, allParams);
    return rows[0] || null;
  }

  async updateByIdAndCompanyId(id, companyId, data) {
    const keys = Object.keys(data);
    if (!keys.length) {
      return;
    }

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => data[key]);

    const query = `
      UPDATE employees
      SET ${setClause}
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [...values, id, companyId]);
  }

  async softDeleteByIdAndCompanyId(id, companyId) {
    const query = `
      UPDATE employees
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new EmployeeModel();
