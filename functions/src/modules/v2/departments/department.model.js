const db = require("../../../config/db.config");

class DepartmentModel {
  async listDepartmentsForOverview(companyId, limit = 500) {
    const query = `
      SELECT
        d.id,
        d.company_id,
        d.department_name,
        d.head_employee_id,
        e.name AS head_employee_name,
        e.employee_code AS head_employee_code,
        COUNT(emp.id) AS employee_count
      FROM departments d
      LEFT JOIN employees e
        ON e.id = d.head_employee_id
       AND e.company_id = d.company_id
       AND e.deleted_at IS NULL
      LEFT JOIN employees emp
        ON emp.department_id = d.id
       AND emp.company_id = d.company_id
       AND emp.deleted_at IS NULL
      WHERE d.company_id = ?
      GROUP BY
        d.id,
        d.company_id,
        d.department_name,
        d.head_employee_id,
        e.name,
        e.employee_code
      ORDER BY d.department_name ASC, d.id ASC
      LIMIT ?
    `;

    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

  async listEmployeesForOverview(companyId, limit = 2000) {
    const query = `
      SELECT
        e.id,
        e.company_id,
        e.employee_code,
        e.department_id,
        e.name,
        e.email,
        e.image_url,
        e.phone_number,
        e.status,
        e.start_date,
        e.resign_date,
        d.department_name
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
       AND d.company_id = e.company_id
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
      ORDER BY e.name ASC, e.id ASC
      LIMIT ?
    `;

    const [rows] = await db.query(query, [companyId, limit]);
    return rows;
  }

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
