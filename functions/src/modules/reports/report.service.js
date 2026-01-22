/**
 * /src/modules/reports/report.service.js
 *
 * Report Service
 * จัดการ Business Logic สำหรับ Reports
 */

const reportModel = require("./report.model");

class ReportService {
  /**
   * ดึงข้อมูล Report ทั้งหมด
   * @param {number} companyId - รหัสบริษัท
   * @param {Object} options - ตัวเลือกต่างๆ
   * @param {string} options.startDate - วันที่เริ่มต้น
   * @param {string} options.endDate - วันที่สิ้นสุด
   * @param {number} options.year - ปีที่ต้องการ (สำหรับ monthly summary)
   * @returns {Object} ข้อมูล report ทั้งหมด
   */
  async getReportData(companyId, options = {}) {
    // กำหนดค่าเริ่มต้นเป็นเดือนปัจจุบัน
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startDate =
      options.startDate || defaultStartDate.toISOString().split("T")[0];
    const endDate =
      options.endDate || defaultEndDate.toISOString().split("T")[0];
    const year = options.year || now.getFullYear();

    // ดึงข้อมูลทั้งหมดพร้อมกัน
    const [
      overviewStats,
      hourSummary,
      attendanceTrend,
      departmentDistribution,
      monthlySummary,
      individualSummary,
    ] = await Promise.all([
      reportModel.getOverviewStats(companyId, startDate, endDate),
      reportModel.getHourSummary(companyId, startDate, endDate),
      reportModel.getAttendanceTrend(companyId, startDate, endDate),
      reportModel.getDepartmentDistribution(companyId),
      reportModel.getMonthlySummary(companyId, year),
      reportModel.getIndividualSummary(companyId, startDate, endDate, 10),
    ]);

    return {
      overviewStats,
      hourSummary,
      attendanceTrend,
      departmentDistribution,
      monthlySummary,
      individualSummary,
      dateRange: { startDate, endDate },
      year,
    };
  }

  /**
   * ดึงข้อมูลสถิติภาพรวม
   */
  async getOverviewStats(companyId, startDate, endDate) {
    return reportModel.getOverviewStats(companyId, startDate, endDate);
  }

  /**
   * ดึงข้อมูลสรุปชั่วโมง
   */
  async getHourSummary(companyId, startDate, endDate) {
    return reportModel.getHourSummary(companyId, startDate, endDate);
  }

  /**
   * ดึงข้อมูล trend การเข้างาน
   */
  async getAttendanceTrend(companyId, startDate, endDate) {
    return reportModel.getAttendanceTrend(companyId, startDate, endDate);
  }

  /**
   * ดึงข้อมูลการกระจายตามแผนก
   */
  async getDepartmentDistribution(companyId) {
    return reportModel.getDepartmentDistribution(companyId);
  }

  /**
   * ดึงข้อมูลสรุปรายเดือน
   */
  async getMonthlySummary(companyId, year) {
    return reportModel.getMonthlySummary(companyId, year);
  }

  /**
   * ดึงข้อมูลสรุปรายบุคคล
   */
  async getIndividualSummary(companyId, startDate, endDate, limit = 10) {
    return reportModel.getIndividualSummary(
      companyId,
      startDate,
      endDate,
      limit
    );
  }
}

module.exports = new ReportService();
