const StatsModel = require("./stats.model");
const AppError = require("../../../utils/AppError");

class StatsService {
  static ATTENDANCE_STATUS_LABELS = {
    pending: "รอดำเนินการ",
    normal: "ปกติ",
    late: "มาสาย",
    early_exit: "ออกก่อนเวลา",
    late_and_early_exit: "มาสายและออกก่อนเวลา",
    absent: "ขาดงาน",
    leave: "ลา",
    holiday: "วันหยุด",
  };

  static DAY_TYPE_LABELS = {
    workday: "วันทำงาน",
    weekly_off: "วันหยุดประจำสัปดาห์",
    public_holiday: "วันหยุดนักขัตฤกษ์",
    compensated_holiday: "วันหยุดชดเชย",
    holiday_swap: "วันหยุดสลับ",
    annual_leave: "ลาพักร้อน",
    sick_leave: "ลาป่วย",
    private_leave: "ลากิจ",
    unpaid_leave: "ลาไม่รับเงินเดือน",
    other_leave: "ลาอื่นๆ",
  };

  static LEAVE_DAY_TYPES = new Set([
    "annual_leave",
    "sick_leave",
    "private_leave",
    "unpaid_leave",
    "other_leave",
  ]);

  static HOLIDAY_DAY_TYPES = new Set([
    "weekly_off",
    "public_holiday",
    "compensated_holiday",
    "holiday_swap",
  ]);

  toNumber(value) {
    return Number(value || 0);
  }

  toEnumObject(key, labels) {
    if (!key) return null;
    return {
      key,
      label: labels[key] || key,
    };
  }

  normalizeDate(value, fallback, fieldName) {
    const dateString = String(value || fallback || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      throw new AppError(`${fieldName} ต้องอยู่ในรูปแบบ YYYY-MM-DD`, 400);
    }
    return dateString;
  }

  normalizePage(value, fallback = 1) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.floor(parsed);
  }

  normalizeLimit(value, fallback = 200, max = 1000) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(Math.floor(parsed), max);
  }

  normalizeEmployeeId(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError("employee_id ต้องเป็นตัวเลขที่ถูกต้อง", 400);
    }

    return parsed;
  }

  resolveAttendanceStatus(statusKey, dayTypeKey) {
    if (statusKey) {
      return statusKey;
    }

    if (StatsService.LEAVE_DAY_TYPES.has(dayTypeKey)) {
      return "leave";
    }

    if (StatsService.HOLIDAY_DAY_TYPES.has(dayTypeKey)) {
      return "holiday";
    }

    return null;
  }

  buildReportFilters(query = {}) {
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const startDate = this.normalizeDate(
      query.start_date,
      defaultStartDate,
      "start_date",
    );
    const endDate = this.normalizeDate(query.end_date, defaultEndDate, "end_date");

    if (startDate > endDate) {
      throw new AppError("start_date ต้องน้อยกว่าหรือเท่ากับ end_date", 400);
    }

    const page = this.normalizePage(query.page, 1);
    const limit = this.normalizeLimit(query.limit, 200, 1000);
    const offset = (page - 1) * limit;
    const search = query.search?.trim() || "";

    return {
      filters: {
        start_date: startDate,
        end_date: endDate,
        search,
      },
      page,
      limit,
      offset,
    };
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

  async getIndividualSummary(companyId, query = {}) {
    return this.getEmployeeSummary(companyId, query);
  }

  async getEmployeeSummary(companyId, query = {}) {
    const { filters, page, limit, offset } = this.buildReportFilters(query);

    const [rows, total] = await Promise.all([
      StatsModel.getIndividualSummary(companyId, filters, limit, offset),
      StatsModel.countIndividualSummary(companyId, filters),
    ]);

    return {
      filters,
      records: rows.map((row) => ({
        id: row.employee_id,
        employee_id: row.employee_id,
        employee_code: row.employee_code,
        name: row.employee_name,
        department: row.department_name || "-",
        total_days: Number(row.total_days || 0),
        present_days: Number(row.present_days || 0),
        normal_days: Number(row.normal_days || 0),
        late_days: Number(row.late_days || 0),
        early_exit_days: Number(row.early_exit_days || 0),
        absent_days: Number(row.absent_days || 0),
        leave_days: Number(row.leave_days || 0),
        holiday_days: Number(row.holiday_days || 0),
        total_ot_minutes: Number(row.total_ot_minutes || 0),
        attendanceRate: `${Number(row.attendance_rate || 0).toFixed(2)}%`,
        avg_work_hours: Number(row.avg_work_hours || 0),
        otHours: Number(row.ot_hours || 0),

        // Backward-compatible aliases used by old FE
        lateCount: Number(row.late_count || 0),
        absentCount: Number(row.absent_count || 0),
        leaveCount: Number(row.leave_count || 0),
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.max(Math.ceil(total / limit), 1),
      },
      generated_at: new Date().toISOString(),
    };
  }

  async getDailyAttendance(companyId, query = {}) {
    const { filters } = this.buildReportFilters(query);
    const employeeId = this.normalizeEmployeeId(query.employee_id);

    const dates = [];
    let cursor = new Date(`${filters.start_date}T00:00:00`);
    const end = new Date(`${filters.end_date}T00:00:00`);
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    const [employee, dailyRows] = await Promise.all([
      StatsModel.getDailyAttendanceEmployee(companyId, employeeId),
      StatsModel.getDailyAttendanceRowsForEmployee(
        companyId,
        employeeId,
        filters,
      ),
    ]);

    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404);
    }

    const dailyByDate = new Map();
    for (const row of dailyRows) {
      const statusKey = this.resolveAttendanceStatus(
        row.attendance_status,
        row.day_type,
      );

      dailyByDate.set(row.work_date, {
        attendance_status: this.toEnumObject(
          statusKey,
          StatsService.ATTENDANCE_STATUS_LABELS,
        ),
        day_type: this.toEnumObject(row.day_type, StatsService.DAY_TYPE_LABELS),
        shift: row.shift_id
          ? {
              id: row.shift_id,
              name: row.shift_name,
              start_time: row.shift_start_time,
              end_time: row.shift_end_time,
            }
          : null,
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        late_minutes: Number(row.late_minutes || 0),
        early_exit_minutes: Number(row.early_exit_minutes || 0),
        work_hours: Number(row.work_hours || 0),
        ot_hours: Number(row.ot_hours || 0),
        break_minutes: Number(row.break_minutes || 0),
      });
    }

    return {
      filters: {
        ...filters,
        employee_id: employeeId,
      },
      employee: {
        employee_id: employee.employee_id,
        employee_code: employee.employee_code,
        employee_name: employee.employee_name,
        department_name: employee.department_name || "-",
      },
      records: dates.map((date) => ({
        work_date: date,
        ...(dailyByDate.get(date) || {
          attendance_status: null,
          day_type: null,
          shift: null,
          check_in_time: null,
          check_out_time: null,
          late_minutes: 0,
          early_exit_minutes: 0,
          work_hours: 0,
          ot_hours: 0,
          break_minutes: 0,
        }),
      })),
      meta: {
        total: dates.length,
        page: 1,
        limit: dates.length,
        total_pages: 1,
      },
      generated_at: new Date().toISOString(),
    };
  }
}

module.exports = new StatsService();
