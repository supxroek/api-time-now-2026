const pool = require("../../config/database");

// Model Class
class CompanyModel {
  // ดึงข้อมูลบริษัทของผู้ใช้
  async findCompanyById(companyId) {
    const query = "SELECT * FROM companies WHERE id = ?";
    const [rows] = await pool.execute(query, [companyId]);
    return rows[0];
  }

  // อัปเดตข้อมูลบริษัทในฐานข้อมูล โดยใช้ PATCH
  async updateCompany(companyId, updateData) {
    // sanitize branch (remove leading non-letter/number e.g. phinthu or dots)
    if (Object.hasOwn(updateData, "branch")) {
      updateData.branch = String(updateData.branch ?? "")
        .trim()
        .replace(/^[^\p{L}\p{N}]+/u, ""); // ลบอักขระนำหน้าไม่ใช่ตัวอักษร/ตัวเลข
    }

    const fields = [];
    const values = [];
    for (const key in updateData) {
      fields.push(`${key} = ?`);
      values.push(updateData[key]);
    }
    const query = `UPDATE companies SET ${fields.join(", ")} WHERE id = ?`;
    values.push(companyId);
    await pool.execute(query, values);

    // ดึงข้อมูลบริษัทที่อัปเดตแล้ว
    return this.findCompanyById(companyId);
  }
}

module.exports = new CompanyModel();
