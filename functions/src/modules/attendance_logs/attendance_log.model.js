const db = require("../../config/db.config");

// Attendance Log Model
class AttendanceLogModel {
  // ==============================================================
  // ค้นหาบันทึกการเข้าออกงานทั้งหมด
  async findAll(companyId, filters = {}, limit = 50, offset = 0) {
    let query = `
      SELECT al.*, 
             e.employee_code, e.name as employee_name, e.image_url as employee_avatar, e.department_id,
             d.name as device_name, d.location_name
      FROM attendance_logs al
      JOIN employees e ON al.employee_id = e.id
      LEFT JOIN devices d ON al.device_id = d.id
      WHERE e.company_id = ?
    `;
    const params = [companyId];

    // การกรองข้อมูล
    // หากมีการระบุ employee_id
    if (filters.employee_id) {
      query += ` AND al.employee_id = ?`;
      params.push(filters.employee_id);
    }
    // หากมีการระบุ department_id
    if (filters.department_id) {
      query += ` AND e.department_id = ?`;
      params.push(filters.department_id);
    }
    // หากมีการระบุคำค้นหา (ชื่อ หรือ รหัสพนักงาน)
    if (filters.search) {
      query += ` AND (e.name LIKE ? OR e.employee_code LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    // หากมีการระบุช่วงวันที่เริ่มต้น
    if (filters.start_date) {
      query += ` AND DATE(al.log_timestamp) >= ?`;
      params.push(filters.start_date);
    }
    // หากมีการระบุช่วงวันที่สิ้นสุด
    if (filters.end_date) {
      query += ` AND DATE(al.log_timestamp) <= ?`;
      params.push(filters.end_date);
    }
    // หากมีการระบุประเภทบันทึก
    if (filters.log_type) {
      query += ` AND al.log_type = ?`;
      params.push(filters.log_type);
    }

    query += ` ORDER BY al.log_timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // ดึงสถิติการเข้าออกงาน
  async getStats(companyId) {
    const query = `
      SELECT
    -- นับจำนวนพนักงานทั้งหมดในบริษัท
  (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.company_id) AS total_employees,
    -- นับจำนวนพนักงานที่มาทำงานในวันนี้ (เช็คอินแล้ว)
  (SELECT COUNT(DISTINCT al.employee_id)
     FROM attendance_logs al
     JOIN employees e2 ON al.employee_id = e2.id
     WHERE e2.company_id = c.company_id
       AND DATE(al.log_timestamp) = CURDATE()
       AND al.status IS NOT NULL AND al.status != 'null') AS came_to_work,
    -- นับจำนวนพนักงานที่มาทำงานสายในวันนี้ (เช็คอินสาย)
  (SELECT COUNT(DISTINCT al.employee_id)
     FROM attendance_logs al
     JOIN employees e3 ON al.employee_id = e3.id
     WHERE e3.company_id = c.company_id
       AND DATE(al.log_timestamp) = CURDATE()
       AND (al.status = 'late')) AS late,
    -- นับจำนวนพนักงานที่ยังไม่มาทำงานในวันนี้ (มีตารางเวลาเช็คอินแต่ยังไม่เช็คอิน)
  (SELECT COUNT(*)
     FROM rosters r
     JOIN employees e4 ON r.employee_id = e4.id
     LEFT JOIN attendance_logs al2 ON al2.employee_id = r.employee_id
       AND DATE(al2.log_timestamp) = CURDATE()
     WHERE e4.company_id = c.company_id
       AND r.work_date = CURDATE()
       AND al2.id IS NULL) AS not_came_to_work
FROM (SELECT ? AS company_id) c;
    `;
    const [rows] = await db.query(query, [companyId]);
    const stats = rows[0];
    stats.absent = stats.total_employees - stats.came_to_work;
    return stats;
  }

  // ==============================================================
  // ดึงจำนวนบันทึกการเข้าออกงานทั้งหมด
  async countAll(companyId, filters = {}) {
    let query = `
      SELECT COUNT(*) as total
      FROM attendance_logs al
      JOIN employees e ON al.employee_id = e.id
      WHERE e.company_id = ?
    `;
    const params = [companyId];

    if (filters.employee_id) {
      query += ` AND al.employee_id = ?`;
      params.push(filters.employee_id);
    }

    if (filters.department_id) {
      query += ` AND e.department_id = ?`;
      params.push(filters.department_id);
    }

    if (filters.search) {
      query += ` AND (e.name LIKE ? OR e.employee_code LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.start_date) {
      query += ` AND DATE(al.log_timestamp) >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND DATE(al.log_timestamp) <= ?`;
      params.push(filters.end_date);
    }

    if (filters.log_type) {
      query += ` AND al.log_type = ?`;
      params.push(filters.log_type);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  // ==============================================================
  // สรุปการเข้างานรายวันของพนักงานทุกคน
  async getDailySummary(companyId, filters = {}) {
    let query = `
      SELECT 
        e.id as employee_id,
        e.employee_code,
        e.name as employee_name,
        e.image_url as employee_avatar,
        dp.department_name,
        MIN(CASE WHEN al.log_type = 'check_in' THEN al.log_timestamp END) as check_in_time,
        MIN(CASE WHEN al.log_type = 'break_start' THEN al.log_timestamp END) as break_start_time,
        MAX(CASE WHEN al.log_type = 'break_end' THEN al.log_timestamp END) as break_end_time,
        MAX(CASE WHEN al.log_type = 'check_out' THEN al.log_timestamp END) as check_out_time,
        MIN(CASE WHEN al.log_type = 'ot_in' THEN al.log_timestamp END) as ot_in_time,
        MAX(CASE WHEN al.log_type = 'ot_out' THEN al.log_timestamp END) as ot_out_time,
        -- เอาสถานะล่าสุดมาแสดง
        SUBSTRING_INDEX(GROUP_CONCAT(al.status ORDER BY al.log_timestamp DESC SEPARATOR ','), ',', 1) as latest_status
      FROM employees e
      LEFT JOIN departments dp ON e.department_id = dp.id
      LEFT JOIN attendance_logs al ON e.id = al.employee_id AND DATE_FORMAT(al.log_timestamp, '%Y-%m-%d') = ?
      WHERE e.company_id = ?
    `;

    const targetDate = filters.date || new Date().toISOString().split("T")[0];
    const params = [targetDate, companyId];

    if (filters.department_id) {
      query += ` AND e.department_id = ?`;
      params.push(filters.department_id);
    }

    if (filters.search) {
      query += ` AND (e.name LIKE ? OR e.employee_code LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // ต้อง Group By ให้ครบตามมาตรฐาน Strict Mode
    query += ` GROUP BY e.id, e.employee_code, e.name, e.image_url, dp.department_name ORDER BY e.employee_code ASC`;

    const [rows] = await db.query(query, params);
    return rows;
  }

  // ==============================================================
  // ค้นหาประวัติการเข้าออกงานของพนักงานเฉพาะบุคคล (สรุปรายวัน)
  async findHistoryByEmployee(companyId, employeeId, filters = {}) {
    // 1. กำหนดช่วงวันที่ (Default: 1 เดือนย้อนหลัง หรือตาม filter)
    const endDate = filters.end_date || new Date().toISOString().split("T")[0];
    const startDate =
      filters.start_date ||
      new Date(new Date().setDate(new Date().getDate() - 30))
        .toISOString()
        .split("T")[0];

    // 2. ดึงข้อมูลการลงเวลา (เฉพาะที่มีในระบบ)
    // หมายเหตุ: ใช้ SUBSTRING_INDEX + GROUP_CONCAT เพื่อหลีกเลี่ยงปัญหา ONLY_FULL_GROUP_BY ใน MySQL
    let query = `
      SELECT 
        DATE_FORMAT(al.log_timestamp, '%Y-%m-%d') as date,
        MIN(CASE WHEN al.log_type = 'check_in' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) as checkIn,
        MIN(CASE WHEN al.log_type = 'break_start' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) as breakStart,
        MAX(CASE WHEN al.log_type = 'break_end' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) as breakEnd,
        MAX(CASE WHEN al.log_type = 'check_out' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) as checkOut,
        MIN(CASE WHEN al.log_type = 'ot_in' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) as otCheckIn,
        MAX(CASE WHEN al.log_type = 'ot_out' THEN TIME_FORMAT(al.log_timestamp, '%H:%i') END) as otCheckOut,
        SUBSTRING_INDEX(GROUP_CONCAT(al.status ORDER BY al.log_timestamp DESC SEPARATOR ','), ',', 1) as status
      FROM attendance_logs al
      JOIN employees e ON al.employee_id = e.id
      WHERE e.company_id = ? AND al.employee_id = ?
      AND DATE(al.log_timestamp) >= ? AND DATE(al.log_timestamp) <= ?
      GROUP BY DATE_FORMAT(al.log_timestamp, '%Y-%m-%d'), al.employee_id 
      ORDER BY date ASC
    `;

    const [rows] = await db.query(query, [
      companyId,
      employeeId,
      startDate,
      endDate,
    ]);

    // 3. สร้าง Array ของวันที่ทั้งหมดในช่วงเวลาที่เลือก (เพื่อแสดงผลให้ครบทุกวัน)
    const dateMap = new Map();
    rows.forEach((row) => {
      // row.date is string YYYY-MM-DD from SQL DATE_FORMAT
      dateMap.set(row.date, row);
    });

    const fullHistory = [];

    // Generate dates using Date object but formatted to string for comparison
    let curr = new Date(startDate);
    const end = new Date(endDate);

    // Safety break
    let limit = 0;
    while (curr <= end && limit < 366) {
      const dateStr = curr.toISOString().split("T")[0];

      if (dateMap.has(dateStr)) {
        fullHistory.push(dateMap.get(dateStr));
      } else {
        fullHistory.push({
          date: dateStr,
          checkIn: "-",
          breakStart: "-",
          breakEnd: "-",
          checkOut: "-",
          otCheckIn: "-",
          otCheckOut: "-",
          status: "absent",
        });
      }

      curr = new Date(curr.getTime() + 24 * 60 * 60 * 1000);
      limit++;
    }

    // เรียงตามวันที่ (ASC)
    return fullHistory;
  }
}

module.exports = new AttendanceLogModel();
