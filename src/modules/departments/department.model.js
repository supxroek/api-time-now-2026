const pool = require("../../config/database");

// Model Class
class DepartmentModel {
  // ดึงรายการแผนกทั้งหมดสำหรับบริษัทที่ระบุ พร้อมจำนวนพนักงานในแต่ละแผนก
  async findAllByCompanyId(companyId) {
    const query =
      "SELECT d.*, COUNT(e.id) AS employeeCount FROM department d LEFT JOIN employees e ON d.id = e.departmentId WHERE d.companyId = ? GROUP BY d.id";
    const [rows] = await pool.execute(query, [companyId]);
    return rows;
  }

  // สร้างแผนกใหม่สำหรับบริษัทที่ระบุ
  async create(companyId, departmentData) {
    const query =
      "INSERT INTO department (companyId, departmentName, headDep_email, headDep_name, headDep_tel) VALUES (?, ?, ?, ?, ?)";
    try {
      const [result] = await pool.execute(query, [
        companyId,
        departmentData.departmentName,
        departmentData.headDep_email || null,
        departmentData.headDep_name || null,
        departmentData.headDep_tel || null,
      ]);
      return { id: result.insertId, ...departmentData };
    } catch (error) {
      console.error("Model create error:", error);
      throw error;
    }
  }

  // ดึงข้อมูลแผนกตาม ID สำหรับบริษัทที่ระบุ
  async findByIdAndCompanyId(departmentId, companyId) {
    const query = "SELECT * FROM department WHERE id = ? AND companyId = ?";
    const [rows] = await pool.execute(query, [departmentId, companyId]);
    return rows[0];
  }

  // อัปเดตข้อมูลแผนกตาม ID สำหรับบริษัทที่ระบุ โดยใช้ PATCH
  async updateByIdAndCompanyId(departmentId, companyId, updateData) {
    const fields = [];
    const values = [];
    for (const key in updateData) {
      fields.push(`${key} = ?`);
      values.push(updateData[key]);
    }
    const query = `UPDATE department SET ${fields.join(
      ", "
    )} WHERE id = ? AND companyId = ?`;
    values.push(departmentId, companyId);
    await pool.execute(query, values);
    return { id: departmentId, ...updateData };
  }

  // ลบแผนกตาม ID สำหรับบริษัทที่ระบุ
  async deleteByIdAndCompanyId(departmentId, companyId) {
    const query = "DELETE FROM department WHERE id = ? AND companyId = ?";
    await pool.execute(query, [departmentId, companyId]);
    return { message: "Department deleted successfully" };
  }
}

module.exports = new DepartmentModel();
