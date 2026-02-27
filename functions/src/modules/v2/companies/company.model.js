const db = require("../../../config/db.config");

class CompanyModel {
  async findProfileByCompanyId(companyId) {
    const query = `
      SELECT * FROM companies WHERE id = ? LIMIT 1
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows[0] || null;
  }

  async updateProfileByCompanyId(companyId, data) {
    const keys = Object.keys(data);
    if (!keys.length) {
      return;
    }

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => data[key]);

    const query = `
      UPDATE companies
      SET ${setClause}
      WHERE id = ?
    `;

    await db.query(query, [...values, companyId]);
  }
}

module.exports = new CompanyModel();
