const RequestModel = require("./request.model");

// Request Service
class RequestService {
  // ==============================================================
  // ดึงประวัติคำขอทั้งหมด
  async getRequestHistory(companyId, query) {
    const {
      page = 1,
      limit = 50,
      employee_id,
      status,
      request_type,
      search,
    } = query;

    const filters = {
      employee_id,
      status,
      request_type,
      search,
    };
    const offset = (page - 1) * limit;

    // Execute queries in parallel for better performance
    const [requests, total] = await Promise.all([
      RequestModel.findAll(companyId, filters, Number(limit), Number(offset)),
      RequestModel.countAll(companyId, filters),
    ]);

    // Format data: จัดกลุ่มข้อมูลให้เป็นระเบียบเพื่อให้ Frontend นำไปใช้ง่ายและลดการคำนวณซ้ำ
    const formattedRequests = requests.map((req) => ({
      id: req.id,
      company_id: req.company_id,
      request_type: req.request_type,
      status: req.status,
      created_at: req.created_at,

      // 1. Employee Context - ข้อมูลพนักงานผู้ส่งคำขอ
      employee: {
        id: req.employee_id,
        name: req.employee_name,
        code: req.employee_code,
        avatar: req.employee_avatar,
      },

      // 2. Approval Context - ข้อมูลที่เกี่ยวข้องกับการอนุมัติ/ปฏิเสธ
      approval: {
        approver_id: req.approver_id,
        approver_name: req.approver_name,
        processed_at: req.approved_at,
        rejected_reason: req.rejected_reason,
      },

      // 3. Request Content - ข้อมูลดิบจากฟอร์มและหลักฐาน
      content: {
        values: req.request_data, // ข้อมูล JSON จากฐานข้อมูล (date, time, reason ฯลฯ)
        evidence: req.evidence_image,
      },

      // 4. Enhanced Metadata - ข้อมูลรายละเอียดจากการ JOIN (Master Data)
      metadata: {
        // รายละเอียด OT (ถ้ามี)
        ot: req.ot_template_name
          ? {
              name: req.ot_template_name,
              rate: req.ot_rate,
              duration: req.ot_duration,
              time: {
                start: req.ot_start_time,
                end: req.ot_end_time,
              },
            }
          : null,

        // รายละเอียดกะงานเดิม (ใช้สำหรับกรณีสลับกะ Shift Swap)
        original_shift: req.original_shift_name
          ? {
              name: req.original_shift_name,
              time: {
                start: req.original_shift_start,
                end: req.original_shift_end,
              },
            }
          : null,

        // รายละเอียดกะงานใหม่/กะเป้าหมาย (ใช้สำหรับสลับกะ หรือ แก้ไขเวลา)
        target_shift: req.target_shift_name
          ? {
              name: req.target_shift_name,
              time: {
                start: req.target_shift_start,
                end: req.target_shift_end,
              },
            }
          : null,
      },
    }));

    return {
      requests: formattedRequests,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // ขอสถิติ
  async getStats(companyId) {
    return await RequestModel.getStats(companyId);
  }
}

module.exports = new RequestService();
