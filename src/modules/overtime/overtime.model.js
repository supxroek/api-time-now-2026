const pool = require("../../config/database");

// Overtime Model Class
class OvertimeModel {
  // ดึงข้อมูลชั่วโมงทำงานล่วงเวลาทั้งหมด
  async findAll(companyId) {
    const [rows] = await pool.query(
      "SELECT * FROM overtime WHERE companyId = ?",
      [companyId]
    );
    return rows;
  }

  // สร้างชั่วโมงทำงานล่วงเวลาใหม่
  async create(overtimeData, companyId) {
    const { overTimeName, ot_start_time, ot_end_time, employeeId } =
      overtimeData;
    const [result] = await pool.query(
      "INSERT INTO overtime (overTimeName, ot_start_time, ot_end_time, employeeId, companyId) VALUES (?, ?, ?, ?, ?)",
      [overTimeName, ot_start_time, ot_end_time, employeeId, companyId]
    );
    return { id: result.insertId, ...overtimeData, companyId };
  }

  // ค้นหาชั่วโมงทำงานล่วงเวลาตามชื่อภายในบริษัท
  async findByName(overTimeName, companyId) {
    const [rows] = await pool.query(
      "SELECT * FROM overtime WHERE overTimeName = ? AND companyId = ?",
      [overTimeName, companyId]
    );
    return rows[0];
  }

  // อัปเดตข้อมูลชั่วโมงทำงานล่วงเวลา
  async update(id, overtimeData, companyId) {
    const { overTimeName, ot_start_time, ot_end_time, employeeId } =
      overtimeData;
    await pool.query(
      "UPDATE overtime SET overTimeName = ?, ot_start_time = ?, ot_end_time = ?, employeeId = ? WHERE id = ? AND companyId = ?",
      [overTimeName, ot_start_time, ot_end_time, employeeId, id, companyId]
    );
    return { id, ...overtimeData, companyId };
  }

  // ลบข้อมูลชั่วโมงทำงานล่วงเวลา
  async delete(id, companyId) {
    const [result] = await pool.query(
      "DELETE FROM overtime WHERE id = ? AND companyId = ?",
      [id, companyId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = new OvertimeModel();
