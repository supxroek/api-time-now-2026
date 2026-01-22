/**
 * /src/modules/dashboard/dashboard.service.js
 *
 * Dashboard Service
 * จัดการ logic ที่เกี่ยวกับ Dashboard
 */

const DashboardModel = require("./dashboard.model");
const DateUtil = require("../../utilities/date");

class DashboardService {
  /**
   * ดึงเวลาปัจจุบันในรูปแบบ YYYY-MM-DD
   */
  _getCurrentDate() {
    return DateUtil.now().format("YYYY-MM-DD");
  }

  /**
   * ดึงข้อมูล Dashboard ทั้งหมด
   * @param {number} companyId - รหัสบริษัท
   * @param {object} options - ตัวเลือก
   */
  async getDashboardData(companyId, options = {}) {
    const currentDate = options.date || this._getCurrentDate();

    // ดึงข้อมูลทั้งหมดพร้อมกัน
    const [stats, recentActivities, departments] = await Promise.all([
      DashboardModel.getTodayStats(companyId, currentDate),
      DashboardModel.getRecentActivities(companyId, currentDate, 20),
      DashboardModel.getDepartments(companyId),
    ]);

    return {
      stats,
      recentActivities,
      departments,
      date: currentDate,
    };
  }

  /**
   * ดึงสถิติการเข้างานของวันนี้
   * @param {number} companyId - รหัสบริษัท
   */
  async getTodayStats(companyId) {
    const currentDate = this._getCurrentDate();
    return await DashboardModel.getTodayStats(companyId, currentDate);
  }

  /**
   * ดึงรายการ attendance ของวันนี้
   * @param {number} companyId - รหัสบริษัท
   * @param {object} options - ตัวเลือก (page, limit, department, status, search)
   */
  async getTodayAttendanceRecords(companyId, options = {}) {
    const currentDate = options.date || this._getCurrentDate();
    return await DashboardModel.getTodayAttendanceRecords(
      companyId,
      currentDate,
      options
    );
  }

  /**
   * ดึงกิจกรรมล่าสุด
   * @param {number} companyId - รหัสบริษัท
   * @param {number} limit - จำนวนรายการ
   */
  async getRecentActivities(companyId, limit = 20) {
    const currentDate = this._getCurrentDate();
    return await DashboardModel.getRecentActivities(
      companyId,
      currentDate,
      limit
    );
  }

  /**
   * ดึงรายชื่อแผนกทั้งหมด
   * @param {number} companyId - รหัสบริษัท
   */
  async getDepartments(companyId) {
    return await DashboardModel.getDepartments(companyId);
  }

  /**
   * ดึงประวัติการเข้างานย้อนหลังของพนักงาน
   * @param {number} employeeId - รหัสพนักงาน
   * @param {number} days - จำนวนวันย้อนหลัง
   */
  async getEmployeeHistory(employeeId, days = 5) {
    return await DashboardModel.getEmployeeHistory(employeeId, days);
  }
}

module.exports = new DashboardService();
