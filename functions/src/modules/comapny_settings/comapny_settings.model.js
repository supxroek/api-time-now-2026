const db = require("../../config/db.config");

// Company Modules Model
class CompanyModulesModel {
  // ==============================================================
  // ดึงรายการโมดูลบริษัททั้งหมด
  static async findAll(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `SELECT company_modules.*, modules.module_name AS module_name, modules.module_key AS module_key
                 FROM company_modules
                 JOIN modules ON company_modules.module_id = modules.id
                 WHERE company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND module_name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวนโมดูลบริษัททั้งหมดที่ตรงกับ Filters
  static async countAll(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM company_modules WHERE company_id = ?`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND module_name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงข้อมูลโมดูลบริษัทรายบุคคลตาม ID
  static async findById(id, companyId) {
    const query = `SELECT * FROM company_modules WHERE id = ? AND company_id = ?`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตข้อมูลโมดูลบริษัทรายบุคคล
  static async updateById(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    const values = Object.values(data);

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const query = `UPDATE company_modules SET ${setClause} WHERE id = ? AND company_id = ?`;

    await db.query(query, [...values, id, companyId]);
  }
}

module.exports = CompanyModulesModel;
