const db = require("../../config/db.config");

// Company Model
class CompanyModel {
  // ==============================================================
  // ค้นหาบริษัทโดย ID
  async findById(id) {
    const query = `
      SELECT * FROM companies WHERE id = ?`;

    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตข้อมูลบริษัท
  async update(id, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `UPDATE companies SET ${setClause} WHERE id = ?`;
    await db.query(query, [...values, id]);
  }
}

module.exports = new CompanyModel();
