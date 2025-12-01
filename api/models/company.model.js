/**
 * /api/models/company.model.js
 *
 * Company Model - Organization Domain
 * เป็น Root ของระบบ ทุกอย่างจะผูกกับ Company ID
 *
 * Relationships:
 *   - hasMany -> Departments, Employees, WorkingTimes, OvertimeRules, Devices
 */

const BaseModel = require("./base.model");
// สืบทอดมาจาก BaseModel
class CompanyModel extends BaseModel {
  constructor() {
    super(
      "companies", // tableName - ชื่อ table
      "id", // primaryKey
      ["tax_id"], // hiddenFields - ซ่อนข้อมูลลับ
      [
        // fillable fields - ฟิลด์ที่อนุญาตให้แก้ไข (ตาม SQL schema)
        "name",
        "branch",
        "email",
        "phoneNumber",
        "contactPerson",
        "address",
        "province",
        "district",
        "sub_district",
        "postal_code",
        "tax_id",
        "hasDepartment",
        "employeeLimit",
        "hr_name",
        "hr_email",
        "report_date",
      ]
    );
  }

  // ========================================
  // Custom Queries
  // ========================================

  /** -----------------------------------------------------------------------
   * ค้นหาบริษัทพร้อม Settings พื้นฐาน
   */
  async findWithSettings(companyId) {
    const sql = `
      SELECT 
        id,
        name,
        branch,
        email,
        phoneNumber,
        contactPerson,
        address,
        province,
        district,
        sub_district,
        postal_code,
        hasDepartment,
        employeeLimit,
        hr_name,
        hr_email,
        report_date,
        created_at
      FROM ${this.tableName}
      WHERE id = ?
    `;
    const rows = await this.query(sql, [companyId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /** -----------------------------------------------------------------------
   * ดึงข้อมูล HR Email และ Report Settings สำหรับส่ง Report
   */
  async getReportSettings(companyId) {
    const sql = `
      SELECT 
        id,
        name,
        hr_name,
        hr_email,
        report_date
      FROM ${this.tableName}
      WHERE id = ?
    `;
    const rows = await this.query(sql, [companyId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /** -----------------------------------------------------------------------
   * ค้นหาบริษัทพร้อมสถิติพนักงาน
   */
  async findWithEmployeeStats(companyId) {
    const sql = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM employees WHERE companyId = c.id AND resign_date IS NULL) as active_employees,
        (SELECT COUNT(*) FROM employees WHERE companyId = c.id) as total_employees,
        (SELECT COUNT(*) FROM department WHERE companyId = c.id) as total_departments
      FROM ${this.tableName} c
      WHERE c.id = ?
    `;
    const rows = await this.query(sql, [companyId]);
    return rows.length > 0 ? this.hideFields(rows[0]) : null;
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบสถานะ Subscription (employeeLimit)
   */
  async checkSubscription(companyId) {
    const sql = `
      SELECT 
        c.id,
        c.employeeLimit,
        (SELECT COUNT(*) FROM employees WHERE companyId = c.id AND resign_date IS NULL) as current_employees
      FROM ${this.tableName} c
      WHERE c.id = ?
    `;
    const rows = await this.query(sql, [companyId]);
    if (rows.length === 0) return null;

    const data = rows[0];
    return {
      ...data,
      can_add_employee: data.current_employees < data.employeeLimit,
      remaining_slots: data.employeeLimit - data.current_employees,
    };
  }

  /** -----------------------------------------------------------------------
   * ค้นหาบริษัททั้งหมด
   */
  async findAllCompanies() {
    return this.findAll({
      orderBy: "name ASC",
    });
  }

  /** -----------------------------------------------------------------------
   * อัพเดท Employee Limit
   */
  async updateEmployeeLimit(companyId, limit) {
    return this.update(companyId, { employeeLimit: limit });
  }
}

module.exports = new CompanyModel();
