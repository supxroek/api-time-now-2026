const db = require("../config/db.config");

/**
 * บันทึก Audit Trail ลงฐานข้อมูล
 *
 * @param {object} auditData - ข้อมูลสำหรับบันทึก audit
 * @param {number} auditData.userId - ID ของผู้ใช้งานที่ทำรายการ (req.user.id)
 * @param {number} auditData.companyId - ID ของบริษัท (req.user.company_id)
 * @param {string} auditData.action - ประเภทการกระทำ 'INSERT', 'UPDATE', 'DELETE'
 * @param {string} auditData.table - ชื่อตารางที่ถูกแก้ไข
 * @param {number|string} auditData.recordId - ID ของ record ที่ถูกแก้ไข
 * @param {object} auditData.oldVal - ข้อมูลเก่าก่อนแก้ไข (JSON object) | null กรณี INSERT
 * @param {object} auditData.newVal - ข้อมูลใหม่หลังแก้ไข (JSON object) | null กรณี DELETE
 * @param {string} [auditData.ipAddress] - IP Address ของผู้ทำรายการ (Optional)
 */
const auditRecord = async (auditData) => {
  const {
    userId,
    companyId,
    action,
    table,
    recordId,
    oldVal,
    newVal,
    ipAddress = null,
  } = auditData;
  try {
    const query = `
      INSERT INTO audit_trail 
      (company_id, user_id, action_type, table_name, record_id, old_values, new_values, ip_address) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const oldValJson = oldVal ? JSON.stringify(oldVal) : null;
    const newValJson = newVal ? JSON.stringify(newVal) : null;

    await db.query(query, [
      companyId,
      userId,
      action,
      table,
      recordId,
      oldValJson,
      newValJson,
      ipAddress,
    ]);
  } catch (error) {
    // กรณีบันทึก Audit ไม่สำเร็จ ไม่ควรทำให้ Transaction หลักล้มเหลว แต่ควร Log ไว้
    console.error("FAILED TO RECORD AUDIT TRAIL:", error);
    // ใน Production อาจจะส่ง Alert หรือเขียนลงไฟล์แยกต่างหาก
  }
};

module.exports = auditRecord;
