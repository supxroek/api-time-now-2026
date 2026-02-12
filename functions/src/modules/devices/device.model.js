const db = require("../../config/db.config");

// Device Model
class DeviceModel {
  // ==============================================================
  // สร้างอุปกรณ์ใหม่
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");

    const query = `INSERT INTO devices (${keys.join(", ")}) VALUES (${placeholders})`;

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  // ==============================================================
  // ดึงข้อมูลอุปกรณ์ทั้งหมด พร้อม Pagination และ Filters
  async findAll(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `
      SELECT d.*, 
             (SELECT COUNT(*) FROM device_access_controls dac WHERE dac.device_id = d.id) as access_control_count
      FROM devices d 
      WHERE d.company_id = ? AND d.deleted_at IS NULL`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (d.name LIKE ? OR d.hwid LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.is_active !== undefined) {
      query += ` AND d.is_active = ?`;
      params.push(filters.is_active);
    }

    query += ` ORDER BY d.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // นับจำนวนอุปกรณ์ทั้งหมดที่ตรงกับ Filters
  async countAll(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM devices WHERE company_id = ? AND deleted_at IS NULL`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ? OR hwid LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.is_active !== undefined) {
      query += ` AND is_active = ?`;
      params.push(filters.is_active);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // นับจำนวนสถานะการใช้งาน attendance_logs (stats)
  async countByStats(companyId, filters, stats) {
    let query = `SELECT COUNT(*) as total FROM devices d
      LEFT JOIN attendance_logs al ON d.id = al.device_id
      WHERE d.company_id = ? AND d.deleted_at IS NULL`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (d.name LIKE ? OR d.hwid LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.is_active !== undefined) {
      query += ` AND d.is_active = ?`;
      params.push(filters.is_active);
    }

    if (stats === "today") {
      query += ` AND DATE(al.log_timestamp) = CURDATE()`;
    } else if (stats === "success") {
      query += ` AND DATE(al.log_timestamp) = CURDATE() AND al.status != 'failed'`;
    } else if (stats === "failed") {
      query += ` AND DATE(al.log_timestamp) = CURDATE() AND al.status = 'failed'`;
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // ดึงข้อมูลอุปกรณ์คนเดียวตาม ID
  async findById(id, companyId) {
    const query = `SELECT * FROM devices WHERE id = ? AND company_id = ? AND deleted_at IS NULL`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // ดึงข้อมูลอุปกรณ์ตาม HWID
  async findByHwid(hwid) {
    const query = `SELECT * FROM devices WHERE hwid = ? AND deleted_at IS NULL`;
    const [rows] = await db.query(query, [hwid]);
    return rows[0];
  }

  // ==============================================================
  // อัปเดตข้อมูลอุปกรณ์
  async update(id, companyId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = Object.values(data);

    const query = `UPDATE devices SET ${setClause} WHERE id = ? AND company_id = ?`;
    await db.query(query, [...values, id, companyId]);
  }

  // ==============================================================
  // ลบอุปกรณ์แบบนุ่มนวล (soft delete)
  async softDelete(id, companyId) {
    const query = `UPDATE devices SET deleted_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }

  // ==============================================================
  // ลบอุปกรณ์
  async delete(id, companyId) {
    const query = `DELETE FROM devices WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }

  // ==============================================================
  // ดึงรายชื่ออุปกรณ์เฉพาะที่ถูกลบแบบ soft delete
  async findAllDeleted(companyId, filters = {}, limit = 20, offset = 0) {
    let query = `SELECT * FROM devices WHERE company_id = ? AND deleted_at IS NOT NULL`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ? OR hwid LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // ดึงอุปกรณ์ที่ถูกลบแบบ soft delete ตาม ID
  async findDeletedById(id, companyId) {
    const query = `SELECT * FROM devices WHERE id = ? AND company_id = ?  AND deleted_at IS NOT NULL`;
    const [rows] = await db.query(query, [id, companyId]);
    return rows[0];
  }

  // ==============================================================
  // นับจำนวนอุปกรณ์เฉพาะที่ถูกลบแบบ soft delete
  async countAllDeleted(companyId, filters = {}) {
    let query = `SELECT COUNT(*) as total FROM devices WHERE company_id = ? AND deleted_at IS NOT NULL`;
    const params = [companyId];

    if (filters.search) {
      query += ` AND (name LIKE ? OR hwid LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // กู้คืนอุปกรณ์ที่ถูกลบแบบ soft delete
  async restore(id, companyId) {
    const query = `UPDATE devices SET deleted_at = NULL, is_active = 1 WHERE id = ? AND company_id = ?`;
    await db.query(query, [id, companyId]);
  }

  // ==============================================================
  // อนุญาตการเข้าถึงอุปกรณ์ + รองรับการอนุญาตหลายประเภท (employees, departments, all)
  async grantAccess(deviceId, targetType, targetId) {
    // Check if exists first to avoid duplicates (manual unique check)
    let checkQuery = `SELECT id FROM device_access_controls WHERE device_id = ? AND target_type = ?`;
    const checkParams = [deviceId, targetType];

    if (targetId) {
      checkQuery += ` AND target_id = ?`;
      checkParams.push(targetId);
    } else {
      checkQuery += ` AND target_id IS NULL`;
    }

    const [existing] = await db.query(checkQuery, checkParams);
    if (existing.length > 0) return existing[0].id;

    // Insert
    const query = `INSERT INTO device_access_controls (device_id, target_type, target_id) VALUES (?, ?, ?)`;
    const [result] = await db.query(query, [deviceId, targetType, targetId]);
    return result.insertId;
  }

  // ==============================================================
  // เพิกถอนการเข้าถึงอุปกรณ์
  async revokeAccess(deviceId, targetType, targetId) {
    let query = `DELETE FROM device_access_controls WHERE device_id = ? AND target_type = ?`;
    const params = [deviceId, targetType];

    if (targetId) {
      query += ` AND target_id = ?`;
      params.push(targetId);
    } else {
      query += ` AND target_id IS NULL`;
    }

    await db.query(query, params);
  }

  // ==============================================================
  // ดึงรายการสิทธิ์การเข้าถึงของอุปกรณ์
  async findAccessControlsByDeviceId(deviceId) {
    const query = `
      SELECT dac.*, 
             e.name as employee_name, e.image_url as employee_avatar,
             d.department_name as department_name
      FROM device_access_controls dac
      LEFT JOIN employees e ON dac.target_type = 'employee' AND dac.target_id = e.id
      LEFT JOIN departments d ON dac.target_type = 'department' AND dac.target_id = d.id
      WHERE dac.device_id = ?`;
    const [rows] = await db.query(query, [deviceId]);
    return rows;
  }
}

module.exports = new DeviceModel();
