const pool = require("../../config/database");

// Model Class
class ShiftModel {
  // ดึงข้อมูลกะการทำงานทั้งหมด
  async findAll(companyId) {
    const query = "SELECT * FROM workingTime WHERE companyId = ?";
    const [rows] = await pool.execute(query, [companyId]);
    return rows;
  }

  // ค้นหากะการทำงานโดยใช้ชื่อกะการทำงานและ companyId
  async findByName(shiftName, companyId) {
    const query =
      "SELECT * FROM workingTime WHERE shift_name = ? AND companyId = ?";
    const [rows] = await pool.execute(query, [shiftName, companyId]);
    return rows[0];
  }

  // สร้างกะการทำงานใหม่
  async create(shiftData, companyId) {
    const {
      free_time = 0,
      is_shift = 1,
      shift_name,
      is_night_shift = 0,
      is_specific = 0,
      month = null,
      date = null,
      start_time = null,
      end_time = null,
      is_break = 1,
      break_start_time = null,
      break_end_time = null,
      employeeId = null,
    } = shiftData;

    const query = `
        INSERT INTO workingTime 
            (free_time, is_shift, shift_name, is_night_shift, is_specific,
            month, date, start_time, end_time, is_break, break_start_time,
            break_end_time, companyId, employeeId) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await pool.execute(query, [
      free_time,
      is_shift,
      shift_name,
      is_night_shift,
      is_specific,
      month,
      date,
      start_time,
      end_time,
      is_break,
      break_start_time,
      break_end_time,
      companyId,
      employeeId,
    ]);
    return { id: result.insertId, ...shiftData, companyId };
  }

  // อัปเดตกะการทำงาน
  async update(shiftId, shiftData, companyId) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(shiftData)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    const query = `UPDATE workingTime SET ${fields.join(
      ", "
    )} WHERE id = ? AND companyId = ?`;
    values.push(shiftId, companyId);
    await pool.execute(query, values);
  }

  // มอบหมายกะการทำงานให้พนักงาน (employeeId เป็น JSON string)
  async assignShiftToEmployee(shiftId, employeeIdJson, companyId) {
    const query = `
        UPDATE workingTime 
        SET employeeId = ?
        WHERE id = ? AND companyId = ?`;
    const [result] = await pool.execute(query, [
      employeeIdJson,
      shiftId,
      companyId,
    ]);
    return result.affectedRows > 0;
  }

  // ค้นหากะการทำงานโดย ID
  async findById(shiftId, companyId) {
    const query = "SELECT * FROM workingTime WHERE id = ? AND companyId = ?";
    const [rows] = await pool.execute(query, [shiftId, companyId]);
    return rows[0];
  }

  // ลบกะการทำงาน
  async delete(shiftId, companyId) {
    const query = "DELETE FROM workingTime WHERE id = ? AND companyId = ?";
    const [result] = await pool.execute(query, [shiftId, companyId]);
    return result.affectedRows > 0;
  }
}

module.exports = new ShiftModel();
