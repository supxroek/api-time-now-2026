/**
 * /api/models/department.model.js
 *
 * Department Model - Organization Domain
 * แบ่งกลุ่มพนักงาน
 *
 * Relationships:
 *   - belongsTo -> Company
 *   - hasMany -> Employees
 */

const BaseModel = require("./base.model");

class DepartmentModel extends BaseModel {
  constructor() {
    super(
      "department", // tableName - ชื่อ table
      "id", // primaryKey
      [], // hiddenFields - ฟิลด์ที่ซ่อน
      [
        // fillable fields - ฟิลด์ที่อนุญาตให้แก้ไข (ตาม SQL schema)
        "departmentName",
        "headDep_email",
        "headDep_name",
        "headDep_tel",
        "companyId",
      ]
    );
  }

  // ========================================
  // Custom Queries
  // ========================================

  /** -----------------------------------------------------------------------
   * ค้นหาแผนกทั้งหมดของบริษัท
   */
  async findByCompany(companyId) {
    return this.findAll({
      where: { companyId: companyId },
      orderBy: "departmentName ASC",
    });
  }

  /** -----------------------------------------------------------------------
   * ค้นหาแผนกพร้อมจำนวนพนักงาน (Eager Loading)
   */
  async findWithEmployeeCount(companyId) {
    const sql = `
      SELECT 
        d.*,
        COUNT(e.id) as employee_count,
        SUM(CASE WHEN e.resign_date IS NULL THEN 1 ELSE 0 END) as active_employee_count
      FROM ${this.tableName} d
      LEFT JOIN employees e ON e.departmentId = d.id
      WHERE d.companyId = ?
      GROUP BY d.id
      ORDER BY d.departmentName ASC
    `;
    return this.query(sql, [companyId]);
  }

  /** -----------------------------------------------------------------------
   * ค้นหาแผนกพร้อมข้อมูลหัวหน้าแผนก
   */
  async findWithManager(departmentId) {
    const sql = `
      SELECT 
        d.*
      FROM ${this.tableName} d
      WHERE d.id = ?
    `;
    const rows = await this.query(sql, [departmentId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /** -----------------------------------------------------------------------
   * ค้นหาแผนกพร้อมรายชื่อพนักงาน
   */
  async findWithEmployees(departmentId) {
    // ดึงข้อมูลแผนก
    const department = await this.findById(departmentId);
    if (!department) return null;

    // ดึงข้อมูลพนักงาน
    const employeesSql = `
      SELECT 
        id,
        name,
        lineUserId,
        start_date,
        dayOff,
        resign_date
      FROM employees
      WHERE departmentId = ?
      ORDER BY name ASC
    `;
    const employees = await this.query(employeesSql, [departmentId]);

    return {
      ...department,
      employees,
    };
  }

  /** -----------------------------------------------------------------------
   * ค้นหาแผนกจากชื่อ
   */
  async findByName(companyId, departmentName) {
    return this.findOne({
      companyId: companyId,
      departmentName: departmentName,
    });
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่าชื่อแผนกซ้ำหรือไม่
   */
  async isNameExists(companyId, departmentName, excludeId = null) {
    let sql = `
      SELECT COUNT(*) as total 
      FROM ${this.tableName}
      WHERE companyId = ? AND departmentName = ?
    `;
    const params = [companyId, departmentName];

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    const rows = await this.query(sql, params);
    return rows[0].total > 0;
  }

  /** -----------------------------------------------------------------------
   * ย้ายพนักงานทั้งหมดไปแผนกอื่น
   */
  async transferAllEmployees(fromDepartmentId, toDepartmentId) {
    const sql = `
      UPDATE employees 
      SET departmentId = ?
      WHERE departmentId = ?
    `;
    const [result] = await this.pool.execute(sql, [
      toDepartmentId,
      fromDepartmentId,
    ]);
    return result.affectedRows;
  }

  /** -----------------------------------------------------------------------
   * นับจำนวนพนักงานในแผนก
   */
  async countEmployees(departmentId) {
    const sql = `
      SELECT COUNT(*) as total 
      FROM employees 
      WHERE departmentId = ?
    `;
    const rows = await this.query(sql, [departmentId]);
    return rows[0].total;
  }
}

module.exports = new DepartmentModel();
