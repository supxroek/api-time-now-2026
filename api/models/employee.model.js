/**
 * /api/models/employee.model.js
 *
 * Employee Model - People Domain
 * หัวใจหลักของข้อมูลที่จะมีการ Read บ่อยที่สุด
 *
 * Relationships:
 *   - belongsTo -> Company, Department
 *   - hasMany -> TimestampRecords, ForgetTimestampRequests
 *   - Complex Relation: เชื่อมกับ WorkingTime และ Overtime (เก็บเป็น longtext)
 */

const BaseModel = require("./base.model");

class EmployeeModel extends BaseModel {
  constructor() {
    super(
      "employees", // tableName - ชื่อ table
      "id", // primaryKey
      [
        // hiddenFields - Sensitive Data Hiding - ซ่อนข้อมูลลับ
        "ID_or_Passport_Number",
        "password",
        "pin_code",
        "social_security_number",
        "bank_account_number",
      ],
      [
        // fillable fields - ฟิลด์ที่อนุญาตให้แก้ไข
        "company_id",
        "department_id",
        "employee_code",
        "first_name",
        "last_name",
        "email",
        "phone",
        "position",
        "hire_date",
        "birth_date",
        "gender",
        "address",
        "profile_image_url",
        "status",
        "role",
        "working_time_id",
        "overtime_id",
      ]
    );
  }

  // ========================================
  // Virtual Fields / Computed Properties
  // ========================================

  /** -----------------------------------------------------------------------
   * เพิ่ม Virtual fields ให้กับข้อมูลพนักงาน
   */
  addVirtualFields(employee) {
    if (!employee) return employee;

    return {
      ...employee,
      // Full name
      full_name: `${employee.first_name || ""} ${
        employee.last_name || ""
      }`.trim(),
      // Employment status
      is_active: employee.status === "active",
      // เช็คว่าเป็นพนักงานใหม่หรือไม่ (ภายใน 90 วัน)
      is_new_employee: this.isNewEmployee(employee.hire_date),
    };
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่าเป็นพนักงานใหม่หรือไม่ (ภายใน 90 วัน)
   */
  isNewEmployee(hireDate) {
    if (!hireDate) return false;
    const hire = new Date(hireDate);
    const now = new Date();
    const diffDays = Math.floor((now - hire) / (1000 * 60 * 60 * 24));
    return diffDays <= 90;
  }

  // ========================================
  // Custom Queries
  // ========================================

  /** -----------------------------------------------------------------------
   * ค้นหาพนักงานทั้งหมดของบริษัท
   */
  async findByCompany(companyId, options = {}) {
    const { status = null, departmentId = null, search = null } = options;

    let sql = `
      SELECT 
        e.*,
        d.department_name
      FROM ${this.tableName} e
      LEFT JOIN department d ON d.id = e.department_id
      WHERE e.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ` AND e.status = ?`;
      params.push(status);
    }

    if (departmentId) {
      sql += ` AND e.department_id = ?`;
      params.push(departmentId);
    }

    if (search) {
      sql += ` AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.employee_code LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += ` ORDER BY e.first_name ASC`;

    const rows = await this.query(sql, params);
    return rows.map((row) => this.addVirtualFields(this.hideFields(row)));
  }

  /** -----------------------------------------------------------------------
   * ค้นหาพนักงานพร้อมข้อมูลแผนก
   */
  async findWithDepartment(employeeId) {
    const sql = `
      SELECT 
        e.*,
        d.id as department_id,
        d.department_name,
        d.department_code
      FROM ${this.tableName} e
      LEFT JOIN department d ON d.id = e.department_id
      WHERE e.id = ?
    `;
    const rows = await this.query(sql, [employeeId]);
    if (rows.length === 0) return null;

    return this.addVirtualFields(this.hideFields(rows[0]));
  }

  /** -----------------------------------------------------------------------
   * ค้นหาพนักงานพร้อมข้อมูลกะงาน
   */
  async findWithWorkingTime(employeeId) {
    const sql = `
      SELECT 
        e.*,
        d.department_name,
        w.id as working_time_id,
        w.shift_name,
        w.check_in_time,
        w.check_out_time,
        w.break_start,
        w.break_end,
        w.late_threshold_minutes
      FROM ${this.tableName} e
      LEFT JOIN department d ON d.id = e.department_id
      LEFT JOIN workingTime w ON w.id = e.working_time_id
      WHERE e.id = ?
    `;
    const rows = await this.query(sql, [employeeId]);
    if (rows.length === 0) return null;

    return this.addVirtualFields(this.hideFields(rows[0]));
  }

  /** -----------------------------------------------------------------------
   * ค้นหาพนักงานจาก Employee Code
   */
  async findByCode(companyId, employeeCode) {
    const employee = await this.findOne({
      company_id: companyId,
      employee_code: employeeCode,
    });
    return employee ? this.addVirtualFields(employee) : null;
  }

  /** -----------------------------------------------------------------------
   * ค้นหาพนักงานจาก Email
   */
  async findByEmail(email) {
    const employee = await this.findOne({ email });
    return employee ? this.addVirtualFields(employee) : null;
  }

  /** -----------------------------------------------------------------------
   * ค้นหาพนักงานพร้อมข้อมูลสำหรับ Authentication (รวม password)
   */
  async findByEmailForAuth(email) {
    const sql = `
      SELECT 
        id,
        company_id,
        department_id,
        employee_code,
        first_name,
        last_name,
        email,
        password,
        role,
        status
      FROM ${this.tableName}
      WHERE email = ?
    `;
    const rows = await this.query(sql, [email]);
    return rows.length > 0 ? rows[0] : null;
  }

  /** -----------------------------------------------------------------------
   * ค้นหาพนักงานในแผนก
   */
  async findByDepartment(departmentId) {
    const rows = await this.findAll({
      where: { department_id: departmentId },
      orderBy: "first_name ASC",
    });
    return rows.map((row) => this.addVirtualFields(row));
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่า Employee Code ซ้ำหรือไม่
   */
  async isCodeExists(companyId, employeeCode, excludeId = null) {
    let sql = `
      SELECT COUNT(*) as total 
      FROM ${this.tableName}
      WHERE company_id = ? AND employee_code = ?
    `;
    const params = [companyId, employeeCode];

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    const rows = await this.query(sql, params);
    return rows[0].total > 0;
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่า Email ซ้ำหรือไม่
   */
  async isEmailExists(email, excludeId = null) {
    let sql = `
      SELECT COUNT(*) as total 
      FROM ${this.tableName}
      WHERE email = ?
    `;
    const params = [email];

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    const rows = await this.query(sql, params);
    return rows[0].total > 0;
  }

  /** -----------------------------------------------------------------------
   * อัพเดท Password
   */
  async updatePassword(employeeId, hashedPassword) {
    const sql = `
      UPDATE ${this.tableName} 
      SET password = ?, updated_at = NOW()
      WHERE id = ?
    `;
    const [result] = await this.pool.execute(sql, [hashedPassword, employeeId]);
    return result.affectedRows > 0;
  }

  /** -----------------------------------------------------------------------
   * อัพเดท Status (Active/Inactive/Resigned)
   */
  async updateStatus(employeeId, status) {
    return this.update(employeeId, { status });
  }

  /** -----------------------------------------------------------------------
   * นับพนักงานที่ Active ในบริษัท
   */
  async countActiveByCompany(companyId) {
    const sql = `
      SELECT COUNT(*) as total 
      FROM ${this.tableName}
      WHERE company_id = ? AND status = 'active'
    `;
    const rows = await this.query(sql, [companyId]);
    return rows[0].total;
  }

  /** -----------------------------------------------------------------------
   * ดึงรายการพนักงานที่วันเกิดตรงกับวันนี้
   */
  async findBirthdayToday(companyId) {
    const sql = `
      SELECT 
        id,
        employee_code,
        first_name,
        last_name,
        email,
        department_id,
        birth_date
      FROM ${this.tableName}
      WHERE company_id = ? 
        AND status = 'active'
        AND MONTH(birth_date) = MONTH(CURDATE())
        AND DAY(birth_date) = DAY(CURDATE())
    `;
    return this.query(sql, [companyId]);
  }
}

module.exports = new EmployeeModel();
