/**
 * /src/modules/request/request.service.js
 *
 * Request Service
 * จัดการตรรกะทางธุรกิจที่เกี่ยวกับคำขอ (requests)
 */

// import database models and utilities
const RequestModel = require("./request.model");
const pool = require("../../config/database");
const DateUtil = require("../../utilities/date");

// Service Class
class RequestService {
  // ========= Employee Side (คนขอ) =========

  /**
   * ดึงคำขอของพนักงาน
   */
  async getMyRequests(employeeId, companyId) {
    if (!employeeId || !companyId) {
      throw new Error("employeeId and companyId are required");
    }
    return await RequestModel.findByEmployeeId(employeeId, companyId);
  }

  /**
   * สร้างคำขอลืมบันทึกเวลา
   */
  async createForgetTimeRequest(companyId, requestData) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // แปลง forget_date เป็น format ที่ถูกต้อง
      if (requestData.forget_date) {
        requestData.forget_date = DateUtil.toDbDate(requestData.forget_date);
      }

      // แปลง forget_time เป็น format TIME (HH:mm:ss)
      if (requestData.forget_time) {
        requestData.forget_time = DateUtil.toDbTime(requestData.forget_time);
      }

      // ตรวจสอบคำขอซ้ำกัน (สถานะ pending)
      const isDuplicate = await RequestModel.checkDuplicateRequest(
        requestData.employeeId,
        companyId,
        requestData.timestamp_type,
        requestData.forget_date,
        requestData.forget_time
      );

      if (isDuplicate) {
        const error = new Error("มีคำขอซ้ำกันในสถานะรอดำเนินการอยู่แล้ว");
        error.statusCode = 409;
        throw error;
      }

      const newRequest = await RequestModel.createForgetTimeRequest(
        companyId,
        requestData
      );

      await connection.commit();
      connection.release();
      return newRequest;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ========= Admin Side (ผู้อนุมัติ) =========

  /**
   * ดึงคำขอที่รอการอนุมัติ
   */
  async getPendingRequests(companyId) {
    if (!companyId) {
      throw new Error("companyId is required");
    }
    return await RequestModel.findPendingRequests(companyId);
  }

  /**
   * ดึงประวัติคำขอ (Approved/Rejected)
   */
  async getRequestHistory(companyId, filters) {
    if (!companyId) {
      throw new Error("companyId is required");
    }
    const items = await RequestModel.findRequestHistory(companyId, filters);
    const total = await RequestModel.countRequestHistory(companyId, filters);
    return {
      items,
      total,
      page: Number.parseInt(filters.page) || 1,
      limit: Number.parseInt(filters.limit) || 10,
      totalPages: Math.ceil(total / (Number.parseInt(filters.limit) || 10)),
    };
  }

  /**
   * ดึงสถิติคำขอ
   */
  async getRequestStats(companyId) {
    if (!companyId) {
      throw new Error("companyId is required");
    }
    return await RequestModel.getRequestStats(companyId);
  }

  /**
   * อนุมัติคำขอตาม ID
   * - อัปเดตสถานะคำขอเป็น approved
   * - อัปเดต timestamp_records ตามประเภทคำขอ
   */
  async approveRequest(requestId, companyId) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      if (!requestId || !companyId) {
        throw new Error("requestId and companyId are required");
      }

      // ตรวจสอบว่าคำขอมีอยู่และยังเป็น pending
      const request = await RequestModel.findByRequestId(requestId, companyId);
      if (!request) {
        const error = new Error("ไม่พบคำขอ");
        error.statusCode = 404;
        throw error;
      }
      if (request.status !== "pending") {
        const error = new Error("คำขอนี้ได้รับการดำเนินการแล้ว");
        error.statusCode = 400;
        throw error;
      }

      // อัปเดตสถานะคำขอเป็น approved
      const approved = await RequestModel.approveRequest(requestId, companyId);

      if (approved) {
        // อัปเดต timestamp_records
        await this._updateTimestampRecord(request);
      }

      await connection.commit();
      connection.release();
      return {
        success: approved,
        message: approved
          ? "อนุมัติคำขอสำเร็จ และอัปเดตเวลาเรียบร้อยแล้ว"
          : "ไม่สามารถอนุมัติคำขอได้",
        requestId,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Helper: อัปเดต timestamp_records จากคำขอที่อนุมัติ
   */
  async _updateTimestampRecord(request) {
    const {
      employee_id,
      company_id,
      timestamp_type,
      forget_date,
      forget_time,
    } = request;

    // ค้นหา timestamp record ของวันที่ร้องขอ
    let record = await RequestModel.findTimestampRecord(
      employee_id,
      company_id,
      forget_date
    );

    // ถ้าไม่มี record ของวันนั้น ให้สร้างใหม่
    if (!record) {
      // ค้นหา workingTimeId ของพนักงาน
      const workingTimeId = await RequestModel.findEmployeeWorkingTime(
        employee_id,
        company_id
      );

      const recordId = await RequestModel.createTimestampRecord(
        employee_id,
        company_id,
        forget_date,
        workingTimeId
      );

      record = { id: recordId };
    }

    // อัปเดตเวลาตามประเภทคำขอ
    await RequestModel.updateTimestampRecord(
      record.id,
      timestamp_type,
      forget_time
    );

    return true;
  }

  /**
   * ปฏิเสธคำขอตาม ID
   */
  async rejectRequest(requestId, companyId) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      if (!requestId || !companyId) {
        throw new Error("requestId and companyId are required");
      }

      // ตรวจสอบว่าคำขอมีอยู่และยังเป็น pending
      const request = await RequestModel.findByRequestId(requestId, companyId);
      if (!request) {
        const error = new Error("ไม่พบคำขอ");
        error.statusCode = 404;
        throw error;
      }
      if (request.status !== "pending") {
        const error = new Error("คำขอนี้ได้รับการดำเนินการแล้ว");
        error.statusCode = 400;
        throw error;
      }

      const rejected = await RequestModel.rejectRequest(requestId, companyId);

      await connection.commit();
      connection.release();
      return {
        success: rejected,
        message: rejected ? "ปฏิเสธคำขอสำเร็จ" : "ไม่สามารถปฏิเสธคำขอได้",
        requestId,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new RequestService();
