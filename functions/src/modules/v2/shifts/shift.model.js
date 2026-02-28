const db = require("../../../config/db.config");

class ShiftModel {
  async createShift(data) {
    const keys = Object.keys(data);
    const values = keys.map((key) => data[key]);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO shifts (${keys.join(", ")}) VALUES (${placeholders})`;
    const [result] = await db.query(query, values);
    return result.insertId;
  }

  async findShifts(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `
      SELECT id, company_id, name, type, start_time, end_time, is_break,
             break_start_time, break_end_time, is_night_shift, deleted_at
      FROM shifts
      WHERE company_id = ? AND deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.search) {
      query += " AND name LIKE ?";
      params.push(`%${filters.search}%`);
    }

    if (filters.type) {
      query += " AND type = ?";
      params.push(filters.type);
    }

    query += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async countShifts(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) AS total
      FROM shifts
      WHERE company_id = ? AND deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.search) {
      query += " AND name LIKE ?";
      params.push(`%${filters.search}%`);
    }

    if (filters.type) {
      query += " AND type = ?";
      params.push(filters.type);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  async findShiftById(id, companyId) {
    const query = `
      SELECT id, company_id, name, type, start_time, end_time, is_break,
             break_start_time, break_end_time, is_night_shift, deleted_at
      FROM shifts
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async findShiftByName(name, companyId, excludeId = null) {
    let query = `
      SELECT id, company_id, name
      FROM shifts
      WHERE name = ? AND company_id = ? AND deleted_at IS NULL
    `;
    const params = [name, companyId];

    if (excludeId) {
      query += " AND id <> ?";
      params.push(excludeId);
    }

    query += " LIMIT 1";
    const [rows] = await db.query(query, params);
    return rows[0] || null;
  }

  async updateShift(id, companyId, data) {
    const keys = Object.keys(data);
    if (!keys.length) {
      return;
    }

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => data[key]);

    const query = `UPDATE shifts SET ${setClause} WHERE id = ? AND company_id = ?`;
    await db.query(query, [...values, id, companyId]);
  }

  async softDeleteShift(id, companyId) {
    const query = `
      UPDATE shifts
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
    `;
    await db.query(query, [id, companyId]);
  }

  async restoreShift(id, companyId) {
    const query = `
      UPDATE shifts
      SET deleted_at = NULL
      WHERE id = ? AND company_id = ? AND deleted_at IS NOT NULL
    `;
    await db.query(query, [id, companyId]);
  }

  async findDeletedShiftById(id, companyId) {
    const query = `
      SELECT id, company_id, name, type, start_time, end_time, is_break,
             break_start_time, break_end_time, is_night_shift, deleted_at
      FROM shifts
      WHERE id = ? AND company_id = ? AND deleted_at IS NOT NULL
      LIMIT 1
    `;
    const [rows] = await db.query(query, [id, companyId]);
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

  async findAssignments(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `
      SELECT
        esa.id,
        esa.company_id,
        esa.employee_id,
        esa.shift_mode,
        esa.shift_id,
        esa.effective_from,
        esa.effective_to,
        esa.created_by,
        esa.created_at,
        e.name AS employee_name,
        s.name AS shift_name
      FROM employee_shift_assignments esa
      LEFT JOIN employees e ON e.id = esa.employee_id
      LEFT JOIN shifts s ON s.id = esa.shift_id
      WHERE esa.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += " AND esa.employee_id = ?";
      params.push(filters.employee_id);
    }

    if (filters.shift_mode) {
      query += " AND esa.shift_mode = ?";
      params.push(filters.shift_mode);
    }

    query += " ORDER BY esa.id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async countAssignments(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) AS total
      FROM employee_shift_assignments esa
      WHERE esa.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += " AND esa.employee_id = ?";
      params.push(filters.employee_id);
    }

    if (filters.shift_mode) {
      query += " AND esa.shift_mode = ?";
      params.push(filters.shift_mode);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  async findAssignmentById(id, companyId) {
    const query = `
      SELECT id, company_id, employee_id, shift_mode, shift_id,
             effective_from, effective_to, created_by, created_at
      FROM employee_shift_assignments
      WHERE id = ? AND company_id = ?
      LIMIT 1
    `;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async findActiveAssignmentByEmployee(employeeId, companyId) {
    const query = `
      SELECT id, company_id, employee_id, shift_mode, shift_id,
             effective_from, effective_to, created_by, created_at
      FROM employee_shift_assignments
      WHERE employee_id = ? AND company_id = ? AND effective_to IS NULL
      ORDER BY effective_from DESC
      LIMIT 1
    `;
    const [rows] = await db.query(query, [employeeId, companyId]);
    return rows[0] || null;
  }

  async findAssignmentAtDate(employeeId, companyId, workDate) {
    const query = `
      SELECT id, company_id, employee_id, shift_mode, shift_id,
             effective_from, effective_to, created_by, created_at
      FROM employee_shift_assignments
      WHERE employee_id = ?
        AND company_id = ?
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC
      LIMIT 1
    `;
    const [rows] = await db.query(query, [
      employeeId,
      companyId,
      workDate,
      workDate,
    ]);
    return rows[0] || null;
  }

  async closeActiveAssignmentTx(conn, assignmentId, effectiveTo) {
    const query = `
      UPDATE employee_shift_assignments
      SET effective_to = ?
      WHERE id = ?
    `;
    await conn.query(query, [effectiveTo, assignmentId]);
  }

  async createAssignmentTx(conn, data) {
    const keys = Object.keys(data);
    const values = keys.map((key) => data[key]);
    const placeholders = keys.map(() => "?").join(", ");
    const query = `
      INSERT INTO employee_shift_assignments (${keys.join(", ")})
      VALUES (${placeholders})
    `;

    const [result] = await conn.query(query, values);
    return result.insertId;
  }

  async updateAssignment(id, companyId, data) {
    const keys = Object.keys(data);
    if (!keys.length) {
      return;
    }

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => data[key]);

    const query = `
      UPDATE employee_shift_assignments
      SET ${setClause}
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [...values, id, companyId]);
  }

  async deleteAssignment(id, companyId) {
    const query = `
      DELETE FROM employee_shift_assignments
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [id, companyId]);
  }

  async findCustomDays(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `
      SELECT
        escd.id,
        escd.company_id,
        escd.employee_id,
        escd.work_date,
        escd.shift_id,
        escd.created_by,
        escd.created_at,
        e.name AS employee_name,
        s.name AS shift_name
      FROM employee_shift_custom_days escd
      LEFT JOIN employees e ON e.id = escd.employee_id
      LEFT JOIN shifts s ON s.id = escd.shift_id
      WHERE escd.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += " AND escd.employee_id = ?";
      params.push(filters.employee_id);
    }
    if (filters.start_date) {
      query += " AND escd.work_date >= ?";
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += " AND escd.work_date <= ?";
      params.push(filters.end_date);
    }

    query += " ORDER BY escd.work_date DESC, escd.id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  async countCustomDays(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) AS total
      FROM employee_shift_custom_days escd
      WHERE escd.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += " AND escd.employee_id = ?";
      params.push(filters.employee_id);
    }
    if (filters.start_date) {
      query += " AND escd.work_date >= ?";
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += " AND escd.work_date <= ?";
      params.push(filters.end_date);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  async findCustomDayById(id, companyId) {
    const query = `
      SELECT id, company_id, employee_id, work_date, shift_id, created_by, created_at
      FROM employee_shift_custom_days
      WHERE id = ? AND company_id = ?
      LIMIT 1
    `;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0] || null;
  }

  async findCustomDayByEmployeeAndDate(employeeId, workDate) {
    const query = `
      SELECT id, company_id, employee_id, work_date, shift_id, created_by, created_at
      FROM employee_shift_custom_days
      WHERE employee_id = ? AND work_date = ?
      LIMIT 1
    `;
    const [rows] = await db.query(query, [employeeId, workDate]);
    return rows[0] || null;
  }

  async createCustomDay(data) {
    const keys = Object.keys(data);
    const values = keys.map((key) => data[key]);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `
      INSERT INTO employee_shift_custom_days (${keys.join(", ")})
      VALUES (${placeholders})
    `;
    const [result] = await db.query(query, values);
    return result.insertId;
  }

  async updateCustomDay(id, companyId, data) {
    const keys = Object.keys(data);
    if (!keys.length) {
      return;
    }

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => data[key]);

    const query = `
      UPDATE employee_shift_custom_days
      SET ${setClause}
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [...values, id, companyId]);
  }

  async deleteCustomDay(id, companyId) {
    const query = `
      DELETE FROM employee_shift_custom_days
      WHERE id = ? AND company_id = ?
    `;
    await db.query(query, [id, companyId]);
  }
}

module.exports = new ShiftModel();
