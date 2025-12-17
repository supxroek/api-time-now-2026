/**
 * /src/modules/reports/report.controller.js
 *
 * Report Controller
 * จัดการ HTTP requests สำหรับ Reports
 */

const reportService = require("./report.service");

/**
 * ดึงข้อมูล Report ทั้งหมด
 * GET /api/reports
 */
const getReportData = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate, year } = req.query;

    const data = reportService.getReportData(companyId, {
      startDate,
      endDate,
      year: year ? Number.parseInt(year, 10) : undefined,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in getReportData:", error);
    next(error);
  }
};

/**
 * ดึงข้อมูลสถิติภาพรวม
 * GET /api/reports/overview
 */
const getOverviewStats = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate } = req.query;

    // กำหนดค่าเริ่มต้นเป็นเดือนปัจจุบัน
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const data = await reportService.getOverviewStats(
      companyId,
      startDate || defaultStartDate,
      endDate || defaultEndDate
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in getOverviewStats:", error);
    next(error);
  }
};

/**
 * ดึงข้อมูลสรุปชั่วโมง
 * GET /api/reports/hours
 */
const getHourSummary = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate } = req.query;

    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const data = await reportService.getHourSummary(
      companyId,
      startDate || defaultStartDate,
      endDate || defaultEndDate
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in getHourSummary:", error);
    next(error);
  }
};

/**
 * ดึงข้อมูล trend การเข้างาน
 * GET /api/reports/trend
 */
const getAttendanceTrend = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate } = req.query;

    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const data = await reportService.getAttendanceTrend(
      companyId,
      startDate || defaultStartDate,
      endDate || defaultEndDate
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in getAttendanceTrend:", error);
    next(error);
  }
};

/**
 * ดึงข้อมูลการกระจายตามแผนก
 * GET /api/reports/departments
 */
const getDepartmentDistribution = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;

    const data = await reportService.getDepartmentDistribution(companyId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in getDepartmentDistribution:", error);
    next(error);
  }
};

/**
 * ดึงข้อมูลสรุปรายเดือน
 * GET /api/reports/monthly
 */
const getMonthlySummary = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const { year } = req.query;

    const currentYear = year
      ? Number.parseInt(year, 10)
      : new Date().getFullYear();

    const data = await reportService.getMonthlySummary(companyId, currentYear);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in getMonthlySummary:", error);
    next(error);
  }
};

/**
 * ดึงข้อมูลสรุปรายบุคคล
 * GET /api/reports/individual
 */
const getIndividualSummary = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate, limit } = req.query;

    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const data = await reportService.getIndividualSummary(
      companyId,
      startDate || defaultStartDate,
      endDate || defaultEndDate,
      limit ? Number.parseInt(limit, 10) : 10
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in getIndividualSummary:", error);
    next(error);
  }
};

module.exports = {
  getReportData,
  getOverviewStats,
  getHourSummary,
  getAttendanceTrend,
  getDepartmentDistribution,
  getMonthlySummary,
  getIndividualSummary,
};
