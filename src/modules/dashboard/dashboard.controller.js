/**
 * /src/modules/dashboard/dashboard.controller.js
 *
 * Dashboard Controller
 * จัดการคำขอ (requests) ที่เกี่ยวกับ Dashboard
 */

const DashboardService = require("./dashboard.service");

class DashboardController {
  /**
   * GET /api/dashboard - ดึงข้อมูล Dashboard ทั้งหมด
   */
  async getDashboardData(req, res, next) {
    try {
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลบริษัท กรุณาเข้าสู่ระบบใหม่",
        });
      }

      const result = await DashboardService.getDashboardData(companyId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/stats - ดึงสถิติการเข้างานของวันนี้
   */
  async getTodayStats(req, res, next) {
    try {
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลบริษัท กรุณาเข้าสู่ระบบใหม่",
        });
      }

      const result = await DashboardService.getTodayStats(companyId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/attendance - ดึงรายการ attendance ของวันนี้
   */
  async getTodayAttendanceRecords(req, res, next) {
    try {
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลบริษัท กรุณาเข้าสู่ระบบใหม่",
        });
      }

      const options = {
        page: Number.parseInt(req.query.page, 10) || 1,
        limit: Number.parseInt(req.query.limit, 10) || 10,
        department: req.query.department || "All",
        status: req.query.status || "All",
        search: req.query.search || "",
        date: req.query.date,
      };

      const result = await DashboardService.getTodayAttendanceRecords(
        companyId,
        options
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/activities - ดึงกิจกรรมล่าสุด
   */
  async getRecentActivities(req, res, next) {
    try {
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลบริษัท กรุณาเข้าสู่ระบบใหม่",
        });
      }

      const limit = Number.parseInt(req.query.limit, 10) || 20;
      const result = await DashboardService.getRecentActivities(
        companyId,
        limit
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/employee/:id/history - ดึงประวัติการเข้างานของพนักงาน
   */
  async getEmployeeHistory(req, res, next) {
    try {
      const employeeId = Number.parseInt(req.params.id, 10);
      const days = Number.parseInt(req.query.days, 10) || 5;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: "ไม่พบรหัสพนักงาน",
        });
      }

      const result = await DashboardService.getEmployeeHistory(
        employeeId,
        days
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();
