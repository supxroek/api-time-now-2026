const db = require("../../../config/db.config");

class EmployeeModel {
  async findOverviewByCompanyId(companyId, filters = {}, limit = 2000) {
    let query = `
      SELECT
        e.id,
        e.company_id,
        e.employee_code,
        e.department_id,
        e.name,
        e.email,
        e.image_url,
        e.phone_number,
        e.id_or_passport_number,
        e.line_user_id,
        e.start_date,
        e.resign_date,
        e.status,
        e.created_at,
        d.department_name,
        esa.shift_mode,
        esa.shift_id AS default_shift_id,
        esa.effective_from AS shift_effective_from,
        eda.dayoff_mode,
        eda.weekly_days,
        eda.effective_from AS dayoff_effective_from
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
       AND d.company_id = e.company_id
      LEFT JOIN employee_shift_assignments esa
        ON esa.employee_id = e.id
       AND esa.company_id = e.company_id
       AND esa.effective_to IS NULL
      LEFT JOIN employee_dayoff_assignments eda
        ON eda.employee_id = e.id
       AND eda.company_id = e.company_id
       AND eda.effective_to IS NULL
      WHERE e.company_id = ?
        AND e.deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (e.name LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ?)`;
      const keyword = `%${filters.search}%`;
      params.push(keyword, keyword, keyword);
    }

    if (filters.status) {
      query += " AND e.status = ?";
      params.push(filters.status);
    }

    if (filters.department_id) {
      query += " AND e.department_id = ?";
      params.push(Number(filters.department_id));
    }

    query += " ORDER BY e.name ASC, e.id ASC LIMIT ?";
    params.push(limit);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async findDepartmentsByCompanyId(companyId) {
    const query = `
      SELECT
        d.id,
        d.company_id,
        d.department_name,
        d.head_employee_id
      FROM departments d
      WHERE d.company_id = ?
      ORDER BY d.department_name ASC, d.id ASC
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows;
  }

  async findShiftsByCompanyId(companyId) {
    const query = `
      SELECT
        s.id,
        s.company_id,
        s.name,
        s.type,
        s.start_time,
        s.end_time,
        s.is_break,
        s.break_start_time,
        s.break_end_time,
        s.is_night_shift,
        s.deleted_at
      FROM shifts s
      WHERE s.company_id = ?
      ORDER BY s.name ASC, s.id ASC
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows;
  }

  async findCompanyDepartmentModuleState(companyId) {
    const query = `
      SELECT cm.is_enabled
      FROM company_modules cm
      JOIN modules m
        ON m.id = cm.module_id
      WHERE cm.company_id = ?
        AND m.module_key = 'department'
      LIMIT 1
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows[0] || null;
  }

  async removeFutureRostersByEmployee(companyId, employeeId, fromDate) {
    const query = `
      DELETE r
      FROM rosters r
      LEFT JOIN requests req
        ON req.roster_id = r.id
       AND req.company_id = r.company_id
      WHERE r.company_id = ?
        AND r.employee_id = ?
        AND r.work_date >= ?
        AND req.id IS NULL
    `;

    const [result] = await db.query(query, [companyId, employeeId, fromDate]);
    return Number(result.affectedRows || 0);
  }

  async countFutureRostersByEmployee(companyId, employeeId, fromDate) {
    const query = `
      SELECT COUNT(*) AS total
      FROM rosters r
      WHERE r.company_id = ?
        AND r.employee_id = ?
        AND r.work_date >= ?
    `;

    const [rows] = await db.query(query, [companyId, employeeId, fromDate]);
    return Number(rows[0]?.total || 0);
  }

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

  async existsShiftInCompany(shiftId, companyId, executor = db) {
    const query = `
      SELECT id
      FROM shifts
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;
    const [rows] = await executor.query(query, [shiftId, companyId]);
    return rows.length > 0;
  }

  async findCurrentShiftAssignment(employeeId, companyId, executor = db) {
    const query = `
      SELECT id, company_id, employee_id, shift_mode, shift_id, effective_from, effective_to, created_by, created_at
      FROM employee_shift_assignments
      WHERE employee_id = ?
        AND company_id = ?
        AND effective_to IS NULL
      ORDER BY effective_from DESC, id DESC
      LIMIT 1
    `;

    const [rows] = await executor.query(query, [employeeId, companyId]);
    return rows[0] || null;
  }

  async closeCurrentShiftAssignment(assignmentId, effectiveTo, executor = db) {
    const query = `
      UPDATE employee_shift_assignments
      SET effective_to = ?
      WHERE id = ?
    `;

    await executor.query(query, [effectiveTo, assignmentId]);
  }

  async createShiftAssignment(data, executor = db) {
    const query = `
      INSERT INTO employee_shift_assignments
      (company_id, employee_id, shift_mode, shift_id, effective_from, effective_to, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executor.query(query, [
      data.company_id,
      data.employee_id,
      data.shift_mode,
      data.shift_id,
      data.effective_from,
      data.effective_to,
      data.created_by,
    ]);

    return result.insertId;
  }

  async findShiftAssignmentById(id, companyId, executor = db) {
    const query = `
      SELECT id, company_id, employee_id, shift_mode, shift_id, effective_from, effective_to, created_by, created_at
      FROM employee_shift_assignments
      WHERE id = ? AND company_id = ?
      LIMIT 1
    `;

    const [rows] = await executor.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async findCurrentDayoffAssignment(employeeId, companyId, executor = db) {
    const query = `
      SELECT id, company_id, employee_id, dayoff_mode, weekly_days, effective_from, effective_to, created_by, created_at
      FROM employee_dayoff_assignments
      WHERE employee_id = ?
        AND company_id = ?
        AND effective_to IS NULL
      ORDER BY effective_from DESC, id DESC
      LIMIT 1
    `;

    const [rows] = await executor.query(query, [employeeId, companyId]);
    return rows[0] || null;
  }

  async closeCurrentDayoffAssignment(assignmentId, effectiveTo, executor = db) {
    const query = `
      UPDATE employee_dayoff_assignments
      SET effective_to = ?
      WHERE id = ?
    `;

    await executor.query(query, [effectiveTo, assignmentId]);
  }

  async createDayoffAssignment(data, executor = db) {
    const query = `
      INSERT INTO employee_dayoff_assignments
      (company_id, employee_id, dayoff_mode, weekly_days, effective_from, effective_to, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executor.query(query, [
      data.company_id,
      data.employee_id,
      data.dayoff_mode,
      data.weekly_days,
      data.effective_from,
      data.effective_to,
      data.created_by,
    ]);

    return result.insertId;
  }

  async findDayoffAssignmentById(id, companyId, executor = db) {
    const query = `
      SELECT id, company_id, employee_id, dayoff_mode, weekly_days, effective_from, effective_to, created_by, created_at
      FROM employee_dayoff_assignments
      WHERE id = ? AND company_id = ?
      LIMIT 1
    `;

    const [rows] = await executor.query(query, [id, companyId]);
    return rows[0] || null;
  }
}

module.exports = new EmployeeModel();
