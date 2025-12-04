const pool = require("../../config/database");

// Model Class
class DepartmentModel {
  // ดึงรายการแผนกทั้งหมดสำหรับบริษัทที่ระบุ
  async findAllByCompanyId(companyId) {
    const query = "SELECT * FROM department WHERE companyId = ?";
    const [rows] = await pool.execute(query, [companyId]);
    return rows;
  }

  // สร้างแผนกใหม่สำหรับบริษัทที่ระบุ
  async create(companyId, departmentData) {
    const query =
      "INSERT INTO department (companyId, departmentName, headDep_email, headDep_name, headDep_tel) VALUES (?, ?, ?, ?, ?)";
    const [result] = await pool.execute(query, [
      companyId,
      departmentData.departmentName,
      departmentData.headDep_email,
      departmentData.headDep_name,
      departmentData.headDep_tel,
    ]);
    return { id: result.insertId, ...departmentData };
  }

  // ดึงข้อมูลแผนกตาม ID สำหรับบริษัทที่ระบุ
  async findByIdAndCompanyId(departmentId, companyId) {
    const query = "SELECT * FROM department WHERE id = ? AND companyId = ?";
    const [rows] = await pool.execute(query, [departmentId, companyId]);
    return rows[0];
  }

  // อัปเดตข้อมูลแผนกตาม ID สำหรับบริษัทที่ระบุ
  async updateByIdAndCompanyId(departmentId, companyId, updateData) {
    const query =
      "UPDATE department SET name = ?, description = ? WHERE id = ? AND companyId = ?";
    await pool.execute(query, [
      updateData.name,
      updateData.description,
      departmentId,
      companyId,
    ]);
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
