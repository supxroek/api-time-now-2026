const pool = require("../../config/database");

// Model Class
class EmployeeModel {
  // ดึงรายการพนักงานทั้งหมดสำหรับบริษัทที่ระบุ
  async findAllByCompanyId(companyId) {
    const query = "SELECT * FROM employees WHERE companyId = ?";
    const [rows] = await pool.execute(query, [companyId]);
    return rows;
  }

  // สร้างพนักงานใหม่สำหรับบริษัทที่ระบุ
  async create(companyId, employeeData) {
    const query = `INSERT INTO employees
        (companyId, name, ID_or_Passport_Number, lineUserId, start_date, departmentId, dayOff)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await pool.execute(query, [
      companyId,
      employeeData.name,
      employeeData.ID_or_Passport_Number,
      employeeData.lineUserId,
      employeeData.start_date,
      employeeData.departmentId,
      employeeData.dayOff,
    ]);
    return { id: result.insertId, companyId, ...employeeData };
  }

  // ดึงข้อมูลพนักงานตาม ID สำหรับบริษัทที่ระบุ
  async findById(companyId, employeeId) {
    const query = "SELECT * FROM employees WHERE id = ? AND companyId = ?";
    const [rows] = await pool.execute(query, [employeeId, companyId]);
    return rows[0];
  }

  // อัปเดตข้อมูลพนักงานตาม ID สำหรับบริษัทที่ระบุ
  async updateByIdAndCompanyId(companyId, employeeId, updateData) {
    const fields = [];
    const values = [];
    for (const key in updateData) {
      fields.push(`${key} = ?`);
      values.push(updateData[key]);
    }
    const query = `UPDATE employees SET ${fields.join(
      ", "
    )} WHERE id = ? AND companyId = ?`;
    values.push(employeeId, companyId);
    const [result] = await pool.execute(query, values);
    return result;
  }

  // ลบพนักงานตาม ID สำหรับบริษัทที่ระบุ
  async resignByIdAndCompanyId(companyId, employeeId, resignDate) {
    // อัพเดทคอลัมน์ "resign_date" เป็นวันที่ที่รับมา
    const query =
      "UPDATE employees SET resign_date = ? WHERE id = ? AND companyId = ?";
    const [result] = await pool.execute(query, [
      resignDate,
      employeeId,
      companyId,
    ]);
    return result;
  }
}

module.exports = new EmployeeModel();
