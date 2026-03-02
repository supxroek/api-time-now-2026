const StatsModel = require("./stats.model");

class StatsService {
  toNumber(value) {
    return Number(value || 0);
  }

  async getOverview(companyId) {
    const stats = await StatsModel.getAllStats(companyId);

    return {
      duplicate: {
        // พนักงานทั้งหมด ในบริษัท (ไม่รวมพนักงานที่ถูกลบแล้ว หรือลาออกไปแล้ว)
        total_employees: this.toNumber(stats?.employees_total),
        // พนักงานที่มาสายวันนี้ (มาทำงานแต่สาย)
        late_today: this.toNumber(stats?.late_today),
        // พนักงานที่ขาดงานวันนี้ (ไม่มาทำงานและไม่ได้แจ้งล่วงหน้า)
        absent_today: this.toNumber(stats?.absent_today),
      },
      dashboard: {
        //  พนักงานที่มาทำงานวันนี้ (รวมปกติ สาย ออกก่อน และสาย+ออกก่อน)
        present_today: this.toNumber(stats?.present_today),
        // คำขอที่รอดำเนินการ (ยังไม่อนุมัติหรือปฏิเสธ)
        pending_requests: this.toNumber(stats?.pending_requests),
      },
      attendance_logs: {
        // พนักงานที่มาทำงานตรงเวลา (มาทำงานและไม่สาย ไม่ออกก่อน)
        on_time: this.toNumber(stats?.on_time_today),
      },
      requests: {
        // คำขอทั้งหมดในระบบ (รวมทุกสถานะ)
        total_requests: this.toNumber(stats?.requests_total),
        // คำขอที่รอดำเนินการ (ยังไม่อนุมัติหรือปฏิเสธ)
        pending: this.toNumber(stats?.requests_pending),
        // คำขอที่ได้รับการอนุมัติแล้ว
        approved: this.toNumber(stats?.requests_approved),
        // คำขอที่ถูกปฏิเสธแล้ว
        rejected: this.toNumber(stats?.requests_rejected),
      },
      departments: {
        // แผนกทั้งหมดในบริษัท
        total_departments: this.toNumber(stats?.departments_total),
        // พนักงานทั้งหมดในแผนก (ไม่รวมพนักงานที่ถูกลบแล้ว หรือลาออกไปแล้ว)
        total_employees: this.toNumber(stats?.departments_employee_total),
        // แผนกที่มีหัวหน้าแผนก (head_employee_id ไม่เป็น NULL)
        department_heads: this.toNumber(stats?.departments_heads_total),
      },
      ot: {
        // แบบ OT ทั้งหมดในบริษัท (ไม่รวมแบบ OT ที่ถูกลบแล้ว)
        total_ot_templates: this.toNumber(stats?.ot_total),
        // แบบ OT ที่ใช้งานอยู่ (is_active = 1)
        active: this.toNumber(stats?.ot_active),
        // แบบ OT ที่ไม่ใช้งานอยู่ (is_active = 0)
        inactive: this.toNumber(stats?.ot_inactive),
        // การใช้งาน OT ทั้งหมดในบริษัท (รวมทุกสถานะการเข้าออกงาน)
        total_usage: this.toNumber(stats?.ot_usage_total),
      },
      devices: {
        // อุปกรณ์ทั้งหมดในบริษัท (ไม่รวมอุปกรณ์ที่ถูกลบแล้ว)
        total_devices: this.toNumber(stats?.devices_total),
        // อุปกรณ์ที่ออนไลน์อยู่ (is_active = 1)
        online: this.toNumber(stats?.devices_online),
        // อุปกรณ์ที่ออฟไลน์อยู่ (is_active = 0)
        offline: this.toNumber(stats?.devices_offline),
        // อุปกรณ์ที่ถูกกำหนดให้พนักงานใช้งาน (มีการเชื่อมโยงกับ device_access_controls)
        assigned: this.toNumber(stats?.devices_assigned),
      },
      users: {
        // ผู้ใช้ทั้งหมดในบริษัท
        total_users: this.toNumber(stats?.users_total),
        // ผู้ใช้ที่ใช้งานอยู่ (is_active = 1)
        active_users: this.toNumber(stats?.users_active),
        // ผู้ใช้ที่มีบทบาทเป็นแอดมิน
        admin: this.toNumber(stats?.users_admin),
        // ผู้ใช้ที่มีบทบาทเป็นผู้จัดการ (manager)
        manager: this.toNumber(stats?.users_manager),
      },
      audit_trail: {
        // กิจกรรมทั้งหมดในระบบ (รวมทุกประเภทการกระทำ)
        total_activities: this.toNumber(stats?.audit_total),
        // กิจกรรมที่เป็นการสร้างข้อมูล (action_type = 'INSERT')
        total_created: this.toNumber(stats?.audit_insert_total),
        // กิจกรรมที่เป็นการแก้ไขข้อมูล (action_type = 'UPDATE')
        total_updated: this.toNumber(stats?.audit_update_total),
        // กิจกรรมที่เป็นการลบข้อมูล (action_type = 'DELETE')
        total_deleted: this.toNumber(stats?.audit_delete_total),
      },
      generated_at: new Date().toISOString(),
    };
  }
}

module.exports = new StatsService();
