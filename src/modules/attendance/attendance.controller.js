/**
 * /src/modules/attendance/attendance.controller.js
 *
 * Attendance Controller
 * จัดการคำขอ (requests) ที่เกี่ยวกับการบันทึกเวลาการทำงาน
 */

// import attendance service and utilities
const AttendanceService = require("./attendance.service");

// Controller Class
class AttendanceController {
  // ==================== Main Actions ====================

  /**
   * POST /api/attendance/check-in - บันทึกเวลาเข้างาน
   */
  async checkIn(req, res, next) {
    try {
      const employeeId = req.user?.employee_id;

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลพนักงาน กรุณาเข้าสู่ระบบใหม่",
        });
      }

      // ค่าที่ต้องส่งไปยัง service
      const checkInData = {
        location: req.body.location, // ตำแหน่งที่เช็คอิน
        note: req.body.note, // หมายเหตุเพิ่มเติม
      };

      // เรียกใช้ service เพื่อตรวจสอบและบันทึกเวลาเข้างาน
      const result = AttendanceService.checkIn(employeeId, checkInData);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/attendance/check-out - บันทึกเวลาออกงาน
   */
  async checkOut(req, res, next) {
    try {
      const employeeId = req.user?.employee_id;

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลพนักงาน กรุณาเข้าสู่ระบบใหม่",
        });
      }

      // ค่าที่ต้องส่งไปยัง service
      const checkOutData = {
        location: req.body.location, // ตำแหน่งที่เช็คเอาท์
        note: req.body.note, // หมายเหตุเพิ่มเติม
      };

      // เรียกใช้ service เพื่อตรวจสอบและบันทึกเวลาออกงาน
      const result = AttendanceService.checkOut(employeeId, checkOutData);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== Break Actions ====================

  /**
   * POST /api/attendance/break/start - บันทึกเวลาเริ่มพัก
   */
  async breakStart(req, res, next) {
    try {
      const employeeId = req.user?.employee_id;

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลพนักงาน กรุณาเข้าสู่ระบบใหม่",
        });
      }

      // เรียกใช้ service เพื่อตรวจสอบและบันทึกเวลาเริ่มพัก
      const result = AttendanceService.breakStart(employeeId, req.body);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/attendance/break/end - บันทึกเวลาสิ้นสุดการพัก
   */
  async breakEnd(req, res, next) {
    try {
      const employeeId = req.user?.employee_id;

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลพนักงาน กรุณาเข้าสู่ระบบใหม่",
        });
      }

      // เรียกใช้ service เพื่อตรวจสอบและบันทึกเวลาสิ้นสุดการพัก
      const result = AttendanceService.breakEnd(employeeId, req.body);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== Query Actions ====================

  /**
   * GET /api/attendance/today - ดึงข้อมูลการบันทึกเวลางานวันนี้
   */
  async getTodayAttendance(req, res, next) {
    try {
      const employeeId = req.user?.employee_id;

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลพนักงาน กรุณาเข้าสู่ระบบใหม่",
        });
      }

      // เรียกใช้ service เพื่อดึงข้อมูลการบันทึกเวลางานวันนี้
      const result = AttendanceService.getTodayAttendance(employeeId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/attendance/history - ดึงประวัติการบันทึกเวลางาน
   */
  async getAttendanceHistory(req, res, next) {
    try {
      const employeeId = req.user?.employee_id;

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลพนักงาน กรุณาเข้าสู่ระบบใหม่",
        });
      }

      // ตัวเลือกการค้นหา
      const options = {
        startDate: req.query.startDate, // วันที่เริ่มต้น
        endDate: req.query.endDate, // วันที่สิ้นสุด
        page: Number.parseInt(req.query.page, 1), // หน้าที่ต้องการดู (เริ่มต้นที่ 1)
        limit: Number.parseInt(req.query.limit, 10), // จำนวนรายการต่อหน้า (เริ่มต้นที่ 10)
      };

      // เรียกใช้ service เพื่อดึงประวัติการบันทึกเวลางาน
      const result = AttendanceService.getAttendanceHistory(
        employeeId,
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
   * GET /api/attendance/summary - ดึงสรุปการบันทึกเวลางาน
   */
  async getAttendanceSummary(req, res, next) {
    try {
      const employeeId = req.user?.employee_id;

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: "ไม่พบข้อมูลพนักงาน กรุณาเข้าสู่ระบบใหม่",
        });
      }

      // ตัวเลือกการค้นหา
      const options = {
        month: req.query.month ? Number.parseInt(req.query.month) : undefined, // เดือน
        year: req.query.year ? Number.parseInt(req.query.year) : undefined, // ปี
      };

      // เรียกใช้ service เพื่อดึงสรุปการบันทึกเวลางาน
      const result = AttendanceService.getAttendanceSummary(
        employeeId,
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
}

module.exports = new AttendanceController();
