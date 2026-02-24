const db = require("../../config/db.config");

class LeaveHubIntegrationModel {
  // ==============================================================
  // ดึงข้อมูล LeaveHub credential ของบริษัท
  async findCompanyLeaveHubCredentials(companyId) {
    const query = `
      SELECT id, leave_hub_company_id, leave_hub_username, leave_hub_password, last_sync_time
      FROM companies
      WHERE id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [companyId]);
    return rows[0];
  }

  // ==============================================================
  // บันทึกข้อมูลเชื่อมต่อ LeaveHub ลงตาราง companies
  async updateLeaveHubCredentials(companyId, payload) {
    const query = `
      UPDATE companies
      SET
        leave_hub_company_id = ?,
        leave_hub_username = ?,
        leave_hub_password = ?,
        last_sync_time = ?
      WHERE id = ?
    `;

    await db.query(query, [
      payload.leave_hub_company_id,
      payload.leave_hub_username,
      payload.leave_hub_password,
      payload.last_sync_time,
      companyId,
    ]);
  }

  // ==============================================================
  // อัปเดตเวลาซิงก์ล่าสุด
  async updateLastSyncTime(companyId, lastSyncTime) {
    const query = `
      UPDATE companies
      SET last_sync_time = ?
      WHERE id = ?
    `;

    await db.query(query, [lastSyncTime, companyId]);
  }

  // ==============================================================
  // ยกเลิกการเชื่อมต่อ LeaveHub และล้าง credential
  async clearLeaveHubCredentials(companyId) {
    const query = `
      UPDATE companies
      SET
        leave_hub_company_id = NULL,
        leave_hub_username = NULL,
        leave_hub_password = NULL,
        last_sync_time = NULL
      WHERE id = ?
    `;

    await db.query(query, [companyId]);
  }
}

module.exports = new LeaveHubIntegrationModel();
