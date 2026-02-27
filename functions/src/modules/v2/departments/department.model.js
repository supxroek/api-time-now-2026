const db = require("../../../config/db.config");

class DepartmentModel {
  async create(data) {
    const keys = Object.keys(data);
    const values = keys.map((key) => data[key]);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `
      INSERT INTO departments (${keys.join(", ")})
      VALUES (${placeholders})
    `;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  async findAllByCompanyId(companyId, limit = 20, offset = 0, search = "") {
    const params = [companyId];
    let query = `
      SELECT
        d.id,
        d.company_id,
        d.department_name,
        d.head_employee_id
      FROM departments d
      WHERE d.company_id = ?
    `;

    if (search) {
      query += " AND d.department_name LIKE ?";
      params.push(`%${search}%`);
    }

    query += " ORDER BY d.id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async countAllByCompanyId(companyId, search = "") {
    const params = [companyId];
    let query = `
      SELECT COUNT(*) AS total
      FROM departments
      WHERE company_id = ?
    `;

    if (search) {
      query += " AND department_name LIKE ?";
      params.push(`%${search}%`);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  async findByIdAndCompanyId(id, companyId) {
    const query = `
      SELECT id, company_id, department_name, head_employee_id
      FROM departments
      WHERE id = ? AND company_id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async findByNameAndCompanyId(departmentName, companyId) {
    const query = `
      SELECT id, company_id, department_name, head_employee_id
      FROM departments
      WHERE department_name = ? AND company_id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [departmentName, companyId]);
    return rows[0] || null;
  }

  async existsEmployeeInCompany(employeeId, companyId) {
    const query = `
      SELECT id
      FROM employees
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;

    const [rows] = await db.query(query, [employeeId, companyId]);
    return rows.length > 0;
  }

  async updateByIdAndCompanyId(id, companyId, data) {
    const keys = Object.keys(data);
    if (!keys.length) {
      return;
    }

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => data[key]);

    const query = `
      UPDATE departments
      SET ${setClause}
      WHERE id = ? AND company_id = ?
    `;

    await db.query(query, [...values, id, companyId]);
  }

  async deleteByIdAndCompanyId(id, companyId) {
    const query = `
      DELETE FROM departments
      WHERE id = ? AND company_id = ?
    `;

    await db.query(query, [id, companyId]);
  }
}

module.exports = new DepartmentModel();
