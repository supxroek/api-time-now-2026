const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const EmployeeModel = require("./employee.model");
const db = require("../../../config/db.config");

class EmployeeService {
  static ALLOWED_UPDATE_FIELDS = new Set([
    "employee_code",
    "department_id",
    "name",
    "email",
    "image_url",
    "phone_number",
    "id_or_passport_number",
    "line_user_id",
    "start_date",
    "resign_date",
    "status",
  ]);

  filterAllowedFields(payload) {
    const filtered = {};

    Object.keys(payload || {}).forEach((key) => {
      if (EmployeeService.ALLOWED_UPDATE_FIELDS.has(key)) {
        filtered[key] = payload[key];
      }
    });

    return filtered;
  }

  static WEEKDAY_TO_INDEX = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
  };

  static INDEX_TO_WEEKDAY = {
    0: "SUN",
    1: "MON",
    2: "TUE",
    3: "WED",
    4: "THU",
    5: "FRI",
    6: "SAT",
  };

  normalizeOverviewLimit(value) {
    const parsed = Number(value ?? 2000);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 2000;
    }

    return Math.min(Math.floor(parsed), 5000);
  }

  mapWeeklyDaysToIndexes(weeklyDays) {
    if (!weeklyDays) return [];

    let days = weeklyDays;
    if (typeof weeklyDays === "string") {
      try {
        days = JSON.parse(weeklyDays);
      } catch (_error) {
        console.warn("Failed to parse weekly_days JSON:", _error);
        return [];
      }
    }

    if (!Array.isArray(days)) {
      return [];
    }

    return days
      .map((day) => EmployeeService.WEEKDAY_TO_INDEX[String(day).toUpperCase()])
      .filter((value) => Number.isInteger(value))
      .sort((a, b) => a - b);
  }

  mapIndexesToWeeklyDays(indexes = []) {
    if (!Array.isArray(indexes) || indexes.length === 0) {
      return [];
    }

    return indexes
      .map((index) => EmployeeService.INDEX_TO_WEEKDAY[Number(index)])
      .filter(Boolean);
  }

  async getEmployeeOverview(companyId, query = {}) {
    const limit = this.normalizeOverviewLimit(query.limit);
    const filters = {
      search: query.search?.trim(),
      status: query.status,
      department_id: query.department_id,
    };

    const [employeesRaw, departments, shifts, companySetting] =
      await Promise.all([
        EmployeeModel.findOverviewByCompanyId(companyId, filters, limit),
        EmployeeModel.findDepartmentsByCompanyId(companyId),
        EmployeeModel.findShiftsByCompanyId(companyId),
        EmployeeModel.findCompanyDepartmentSetting(companyId),
      ]);

    const employees = employeesRaw.map((employee) => {
      const weeklyHolidayIndexes = this.mapWeeklyDaysToIndexes(
        employee.weekly_days,
      );

      return {
        id: employee.id,
        company_id: employee.company_id,
        employee_code: employee.employee_code,
        department_id: employee.department_id,
        name: employee.name,
        email: employee.email,
        image_url: employee.image_url,
        phone_number: employee.phone_number,
        id_or_passport_number: employee.id_or_passport_number,
        line_user_id: employee.line_user_id,
        start_date: employee.start_date,
        resign_date: employee.resign_date,
        status: employee.status,
        created_at: employee.created_at,
        shift_mode: employee.shift_mode || "normal",
        default_shift_id: employee.default_shift_id,
        dayOff_mode: employee.dayoff_mode || "normal",
        weekly_holidays: weeklyHolidayIndexes,
        shift_assignment: {
          shift_mode: employee.shift_mode || "normal",
          shift_id: employee.default_shift_id,
          effective_from: employee.shift_effective_from,
        },
        dayoff_assignment: {
          dayoff_mode: employee.dayoff_mode || "normal",
          weekly_days: this.mapIndexesToWeeklyDays(weeklyHolidayIndexes),
          effective_from: employee.dayoff_effective_from,
        },
      };
    });

    return {
      company_info: {
        has_department: Number(companySetting?.has_department ?? 1),
      },
      employees,
      departments,
      shifts,
      meta: {
        total: employees.length,
      },
    };
  }

  async ensureUniqueFields(companyId, data, excludeEmployeeId = null) {
    const duplicate = await EmployeeModel.findDuplicateUniqueFields(
      companyId,
      data,
      excludeEmployeeId,
    );

    if (!duplicate) {
      return;
    }

    const map = {
      email: "อีเมล",
      id_or_passport_number: "เลขบัตรประชาชน/หนังสือเดินทาง",
      line_user_id: "Line User ID",
      employee_code: "รหัสพนักงาน",
    };

    const duplicateKey = Object.keys(map).find(
      (key) =>
        data[key] !== undefined &&
        data[key] !== null &&
        data[key] !== "" &&
        duplicate[key] === data[key],
    );

    if (duplicateKey) {
      throw new AppError(
        `${map[duplicateKey]} '${data[duplicateKey]}' นี้มีอยู่ในระบบแล้ว`,
        400,
      );
    }

    throw new AppError("ข้อมูลซ้ำในระบบ", 400);
  }

  async getAllEmployees(companyId, query) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;
    const filters = {
      search: query.search?.trim(),
      status: query.status,
      department_id: query.department_id,
    };

    const employees = await EmployeeModel.findAllByCompanyId(
      companyId,
      filters,
      limit,
      offset,
    );
    // ดึงข้อมูล employee_shift_assignments และ employee_dayoff_assignments สำหรับแต่ละพนักงาน
    for (const employee of employees) {
      employee.shift_assignment =
        await EmployeeModel.findCurrentShiftAssignment(employee.id, companyId);
      employee.dayoff_assignment =
        await EmployeeModel.findCurrentDayoffAssignment(employee.id, companyId);
    }

    const total = await EmployeeModel.countAllByCompanyId(companyId, filters);

    return {
      employees,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEmployeeById(companyId, employeeId) {
    const employee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );
    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404);
    }

    // ดึงข้อมูล employee_shift_assignments และ employee_dayoff_assignments สำหรับพนักงานที่ดึงมา
    employee.shift_assignment = await EmployeeModel.findCurrentShiftAssignment(
      employee.id,
      companyId,
    );
    employee.dayoff_assignment =
      await EmployeeModel.findCurrentDayoffAssignment(employee.id, companyId);

    return employee;
  }

  async updateEmployee(user, employeeId, payload, ipAddress) {
    const companyId = user.company_id;
    const oldEmployee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );

    if (!oldEmployee) {
      throw new AppError("ไม่พบข้อมูลพนักงานที่ต้องการแก้ไข", 404);
    }

    const cleanData = this.filterAllowedFields(payload);

    if (cleanData.name !== undefined && !cleanData.name?.trim()) {
      throw new AppError("กรุณาระบุชื่อพนักงาน", 400);
    }
    if (cleanData.email !== undefined && !cleanData.email?.trim()) {
      throw new AppError("กรุณาระบุอีเมลพนักงาน", 400);
    }
    if (
      cleanData.status &&
      !["active", "resigned", "suspended"].includes(cleanData.status)
    ) {
      throw new AppError("status ไม่ถูกต้อง", 400);
    }

    if (cleanData.name !== undefined) cleanData.name = cleanData.name.trim();
    if (cleanData.email !== undefined) cleanData.email = cleanData.email.trim();

    await this.ensureUniqueFields(companyId, cleanData, Number(employeeId));

    await EmployeeModel.updateByIdAndCompanyId(
      employeeId,
      companyId,
      cleanData,
    );
    const updatedEmployee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "employees",
        recordId: Number(employeeId),
        oldVal: oldEmployee,
        newVal: updatedEmployee,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 employees update):", error);
    }

    return updatedEmployee;
  }

  async deleteEmployee(user, employeeId, ipAddress) {
    const companyId = user.company_id;
    const oldEmployee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );

    if (!oldEmployee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404);
    }

    await EmployeeModel.softDeleteByIdAndCompanyId(employeeId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "DELETE",
        table: "employees",
        recordId: Number(employeeId),
        oldVal: oldEmployee,
        newVal: { ...oldEmployee, deleted_at: new Date() },
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 employees delete):", error);
    }
  }

  toDateOnly(value, fieldName) {
    if (!value) {
      throw new AppError(`กรุณาระบุ ${fieldName}`, 400);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(`${fieldName} ไม่ถูกต้อง`, 400);
    }

    return parsed.toISOString().slice(0, 10);
  }

  previousDate(dateString) {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  normalizeWeeklyDays(weeklyDays) {
    if (!Array.isArray(weeklyDays) || weeklyDays.length === 0) {
      throw new AppError("กรุณาเลือกวันที่ต้องการ", 400);
    }

    const validDays = new Set([
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
      "SUN",
    ]);
    const normalized = weeklyDays.map((day) =>
      String(day).trim().toUpperCase(),
    );

    normalized.forEach((day) => {
      if (!validDays.has(day)) {
        throw new AppError(
          "weekly_days ต้องเป็นค่า MON,TUE,WED,THU,FRI,SAT,SUN เท่านั้น",
          400,
        );
      }
    });

    return [...new Set(normalized)];
  }

  async switchShiftMode(user, employeeId, payload, ipAddress) {
    const companyId = user.company_id;
    const employee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );

    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404);
    }

    const shiftMode = payload.shift_mode;
    if (!["normal", "custom"].includes(shiftMode)) {
      throw new AppError("shift_mode ต้องเป็น normal หรือ custom", 400);
    }

    const effectiveFrom = this.toDateOnly(
      payload.effective_from,
      "effective_from",
    );
    const effectiveTo = this.previousDate(effectiveFrom);

    let shiftId = null;
    if (shiftMode === "normal") {
      if (!payload.shift_id) {
        throw new AppError(
          "เมื่อ shift_mode เป็น normal ต้องระบุ shift_id",
          400,
        );
      }
      const shiftExists = await EmployeeModel.existsShiftInCompany(
        payload.shift_id,
        companyId,
      );
      if (!shiftExists) {
        throw new AppError("ไม่พบ shift_id ในบริษัทนี้", 404);
      }
      shiftId = payload.shift_id;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const currentAssignment = await EmployeeModel.findCurrentShiftAssignment(
        employeeId,
        companyId,
        connection,
      );

      if (currentAssignment) {
        if (effectiveFrom <= currentAssignment.effective_from) {
          throw new AppError(
            "effective_from ใหม่ต้องมากกว่าวันเริ่มต้นของ record ปัจจุบัน",
            400,
          );
        }

        await EmployeeModel.closeCurrentShiftAssignment(
          currentAssignment.id,
          effectiveTo,
          connection,
        );
      }

      const newAssignmentId = await EmployeeModel.createShiftAssignment(
        {
          company_id: companyId,
          employee_id: Number(employeeId),
          shift_mode: shiftMode,
          shift_id: shiftId,
          effective_from: effectiveFrom,
          effective_to: null,
          created_by: user.id,
        },
        connection,
      );

      const newAssignment = await EmployeeModel.findShiftAssignmentById(
        newAssignmentId,
        companyId,
        connection,
      );

      await connection.commit();

      try {
        if (currentAssignment) {
          await auditRecord({
            userId: user.id,
            companyId,
            action: "UPDATE",
            table: "employee_shift_assignments",
            recordId: currentAssignment.id,
            oldVal: currentAssignment,
            newVal: { ...currentAssignment, effective_to: effectiveTo },
            ipAddress,
          });
        }

        await auditRecord({
          userId: user.id,
          companyId,
          action: "INSERT",
          table: "employee_shift_assignments",
          recordId: newAssignmentId,
          oldVal: null,
          newVal: newAssignment,
          ipAddress,
        });
      } catch (error) {
        console.warn("Audit record failed (v2 employee shift switch):", error);
      }

      return {
        employee_id: Number(employeeId),
        closed_assignment: currentAssignment
          ? { ...currentAssignment, effective_to: effectiveTo }
          : null,
        new_assignment: newAssignment,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async switchDayoffMode(user, employeeId, payload, ipAddress) {
    const companyId = user.company_id;
    const employee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );

    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404);
    }

    const dayoffMode = payload.dayoff_mode;
    if (!["normal", "custom"].includes(dayoffMode)) {
      throw new AppError("dayoff_mode ต้องเป็น normal หรือ custom", 400);
    }

    const effectiveFrom = this.toDateOnly(
      payload.effective_from,
      "effective_from",
    );
    const effectiveTo = this.previousDate(effectiveFrom);

    let weeklyDays = null;
    if (dayoffMode === "normal") {
      weeklyDays = this.normalizeWeeklyDays(payload.weekly_days);
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const currentAssignment = await EmployeeModel.findCurrentDayoffAssignment(
        employeeId,
        companyId,
        connection,
      );

      if (currentAssignment) {
        if (effectiveFrom <= currentAssignment.effective_from) {
          throw new AppError(
            "effective_from ใหม่ต้องมากกว่าวันเริ่มต้นของ record ปัจจุบัน",
            400,
          );
        }

        await EmployeeModel.closeCurrentDayoffAssignment(
          currentAssignment.id,
          effectiveTo,
          connection,
        );
      }

      const newAssignmentId = await EmployeeModel.createDayoffAssignment(
        {
          company_id: companyId,
          employee_id: Number(employeeId),
          dayoff_mode: dayoffMode,
          weekly_days: weeklyDays ? JSON.stringify(weeklyDays) : null,
          effective_from: effectiveFrom,
          effective_to: null,
          created_by: user.id,
        },
        connection,
      );

      const newAssignment = await EmployeeModel.findDayoffAssignmentById(
        newAssignmentId,
        companyId,
        connection,
      );

      await connection.commit();

      try {
        if (currentAssignment) {
          await auditRecord({
            userId: user.id,
            companyId,
            action: "UPDATE",
            table: "employee_dayoff_assignments",
            recordId: currentAssignment.id,
            oldVal: currentAssignment,
            newVal: { ...currentAssignment, effective_to: effectiveTo },
            ipAddress,
          });
        }

        await auditRecord({
          userId: user.id,
          companyId,
          action: "INSERT",
          table: "employee_dayoff_assignments",
          recordId: newAssignmentId,
          oldVal: null,
          newVal: newAssignment,
          ipAddress,
        });
      } catch (error) {
        console.warn("Audit record failed (v2 employee dayoff switch):", error);
      }

      return {
        employee_id: Number(employeeId),
        closed_assignment: currentAssignment
          ? { ...currentAssignment, effective_to: effectiveTo }
          : null,
        new_assignment: newAssignment,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async clearFutureRosters(user, employeeId, query = {}) {
    const companyId = user.company_id;
    const employee = await EmployeeModel.findByIdAndCompanyId(
      employeeId,
      companyId,
    );

    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404);
    }

    const fromDate = query.from_date || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fromDate))) {
      throw new AppError("รูปแบบ from_date ไม่ถูกต้อง (YYYY-MM-DD)", 400);
    }

    const totalBefore = await EmployeeModel.countFutureRostersByEmployee(
      companyId,
      Number(employeeId),
      fromDate,
    );
    const deletedCount = await EmployeeModel.removeFutureRostersByEmployee(
      companyId,
      Number(employeeId),
      fromDate,
    );

    return {
      employee_id: Number(employeeId),
      from_date: fromDate,
      deleted_count: deletedCount,
      skipped_count: Math.max(totalBefore - deletedCount, 0),
    };
  }
}

module.exports = new EmployeeService();
