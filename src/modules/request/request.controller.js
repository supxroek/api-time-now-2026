/**
 * /src/modules/request/request.controller.js
 *
 * Request Controller
 * จัดการคำขอ (requests) ที่เกี่ยวกับคำขอ
 */

// import request service and utilities
const RequestService = require("./request.service");

// Request Class
class RequestController {
  // ======== Employee Side (คนขอ) =========

  /**
   * GET /api/requests/my-requests
   * ดึงคำขอของพนักงานที่ล็อกอิน
   */
  async getMyRequests(req, res, next) {
    try {
      const companyId = req.user.company_id;
      const employeeId = req.user.employee_id;

      const result = await RequestService.getMyRequests(employeeId, companyId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/requests/forget-time
   * ส่งคำขอลืมบันทึกเวลา
   */
  async createForgetTimeRequest(req, res, next) {
    try {
      const companyId = req.user.company_id;
      const employeeId = req.user.employee_id;
      const requestData = req.body;

      const result = await RequestService.createForgetTimeRequest(
        employeeId,
        companyId,
        requestData
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ======== Admin Side (ผู้อนุมัติ) =========

  /**
   * GET /api/requests/pending
   * ดึงคำขอที่รอการอนุมัติ
   */
  async getPendingRequests(req, res, next) {
    try {
      const companyId = req.user.company_id;
      const result = await RequestService.getPendingRequests(companyId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/requests/:id/approve
   * อนุมัติคำขอตาม ID
   */
  async approveRequest(req, res, next) {
    try {
      const companyId = req.user.company_id;
      const requestId = Number.parseInt(req.params.id);

      const result = await RequestService.approveRequest(requestId, companyId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/requests/:id/reject
   * ปฏิเสธคำขอตาม ID
   */
  async rejectRequest(req, res, next) {
    try {
      const companyId = req.user.company_id;
      const requestId = Number.parseInt(req.params.id);

      const result = await RequestService.rejectRequest(requestId, companyId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RequestController();
