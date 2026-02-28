const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const db = require("../../../config/db.config");
const ShiftModel = require("./shift.model");

class ShiftService {
  static ALLOWED_SHIFT_FIELDS = new Set([
    "name",
    "type",
    "start_time",
    "end_time",
    "is_break",
    "break_start_time",
    "break_end_time",
    "is_night_shift",
  ]);

  static ALLOWED_ASSIGNMENT_FIELDS = new Set([
    "shift_mode",
    "shift_id",
    "effective_from",
    "effective_to",
  ]);

  static ALLOWED_CUSTOM_DAY_FIELDS = new Set(["work_date", "shift_id"]);

  filterFields(payload, allowedFields) {
    const filtered = {};
    Object.keys(payload || {}).forEach((key) => {
      if (allowedFields.has(key)) {
        filtered[key] = payload[key];
      }
    });

    return filtered;
  }

  async ensureShiftInCompany(companyId, shiftId) {
    if (shiftId === null || shiftId === undefined) {
      return;
    }

    const shift = await ShiftModel.findShiftById(shiftId, companyId);
    if (!shift) {
      throw new AppError("ไม่พบ shift ในบริษัทนี้", 404);
    }
  }

  async ensureEmployeeInCompany(companyId, employeeId) {
    const exists = await ShiftModel.existsEmployeeInCompany(
      employeeId,
      companyId,
    );
    if (!exists) {
      throw new AppError("ไม่พบ employee ในบริษัทนี้", 404);
    }
  }

  normalizeBinaryFlag(data, key, label) {
    if (data[key] === undefined) {
      return;
    }

    const parsedValue = Number(data[key]);
    if (![0, 1].includes(parsedValue)) {
      throw new AppError(`${label} ต้องเป็น 0 หรือ 1`, 400);
    }

    data[key] = parsedValue;
  }

  validateType(data) {
    if (data.type && !["fixed", "flexible"].includes(data.type)) {
      throw new AppError("type ต้องเป็น fixed หรือ flexible", 400);
    }
  }

  validateName(data) {
    if (data.name === undefined) {
      return;
    }

    data.name = data.name?.trim();
    if (!data.name) {
      throw new AppError("กรุณาระบุชื่อกะการทำงาน", 400);
    }
  }

  validateTimeRanges(data) {
    const isNight = data.is_night_shift === 1;

    if (
      data.start_time &&
      data.end_time &&
      !isNight &&
      data.start_time >= data.end_time
    ) {
      throw new AppError("เวลาเริ่มกะต้องน้อยกว่าเวลาสิ้นสุดกะ", 400);
    }

    if (data.is_break === 0) {
      data.break_start_time = null;
      data.break_end_time = null;
      return;
    }

    if (
      data.is_break === 1 &&
      data.break_start_time &&
      data.break_end_time &&
      !isNight &&
      data.break_start_time >= data.break_end_time
    ) {
      throw new AppError("เวลาเริ่มพักต้องน้อยกว่าเวลาสิ้นสุดพัก", 400);
    }
  }

  validateShiftData(data) {
    this.validateType(data);
    this.normalizeBinaryFlag(data, "is_break", "is_break");
    this.normalizeBinaryFlag(data, "is_night_shift", "is_night_shift");
    this.validateName(data);
    this.validateTimeRanges(data);
  }

  async createShift(user, payload, ipAddress) {
    const companyId = user.company_id;
    const cleanData = this.filterFields(
      payload,
      ShiftService.ALLOWED_SHIFT_FIELDS,
    );
    this.validateShiftData(cleanData);

    if (!cleanData.name) {
      throw new AppError("กรุณาระบุชื่อกะการทำงาน", 400);
    }

    const duplicate = await ShiftModel.findShiftByName(
      cleanData.name,
      companyId,
    );
    if (duplicate) {
      throw new AppError("ชื่อกะการทำงานนี้มีอยู่แล้ว", 400);
    }

    const dataToCreate = {
      company_id: companyId,
      name: cleanData.name,
      type: cleanData.type || "fixed",
      start_time: cleanData.start_time || null,
      end_time: cleanData.end_time || null,
      is_break: cleanData.is_break ?? 0,
      break_start_time: cleanData.break_start_time || null,
      break_end_time: cleanData.break_end_time || null,
      is_night_shift: cleanData.is_night_shift ?? 0,
    };

    const newId = await ShiftModel.createShift(dataToCreate);
    const created = await ShiftModel.findShiftById(newId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "INSERT",
        table: "shifts",
        recordId: newId,
        oldVal: null,
        newVal: created,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 shifts create):", error);
    }

    return created;
  }

  async getAllShifts(companyId, query) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;
    const filters = {
      search: query.search?.trim(),
      type: query.type,
    };

    const shifts = await ShiftModel.findShifts(
      companyId,
      filters,
      limit,
      offset,
    );
    const total = await ShiftModel.countShifts(companyId, filters);

    return {
      shifts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getShiftById(companyId, shiftId) {
    const shift = await ShiftModel.findShiftById(shiftId, companyId);
    if (!shift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงาน", 404);
    }
    return shift;
  }

  async updateShift(user, shiftId, payload, ipAddress) {
    const companyId = user.company_id;
    const oldShift = await ShiftModel.findShiftById(shiftId, companyId);
    if (!oldShift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงาน", 404);
    }

    const cleanData = this.filterFields(
      payload,
      ShiftService.ALLOWED_SHIFT_FIELDS,
    );
    this.validateShiftData(cleanData);

    if (cleanData.name && cleanData.name !== oldShift.name) {
      const duplicate = await ShiftModel.findShiftByName(
        cleanData.name,
        companyId,
        Number(shiftId),
      );
      if (duplicate) {
        throw new AppError("ชื่อกะการทำงานนี้มีอยู่แล้ว", 400);
      }
    }

    await ShiftModel.updateShift(shiftId, companyId, cleanData);
    const updated = await ShiftModel.findShiftById(shiftId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "shifts",
        recordId: Number(shiftId),
        oldVal: oldShift,
        newVal: updated,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 shifts update):", error);
    }

    return updated;
  }

  async deleteShift(user, shiftId, ipAddress) {
    const companyId = user.company_id;
    const oldShift = await ShiftModel.findShiftById(shiftId, companyId);
    if (!oldShift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงาน", 404);
    }

    await ShiftModel.softDeleteShift(shiftId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "DELETE",
        table: "shifts",
        recordId: Number(shiftId),
        oldVal: oldShift,
        newVal: { ...oldShift, deleted_at: new Date() },
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 shifts delete):", error);
    }
  }

  async restoreShift(user, shiftId, ipAddress) {
    const companyId = user.company_id;
    const oldShift = await ShiftModel.findDeletedShiftById(shiftId, companyId);
    if (!oldShift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงานที่ถูกลบ", 404);
    }

    await ShiftModel.restoreShift(shiftId, companyId);
    const restored = await ShiftModel.findShiftById(shiftId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "shifts",
        recordId: Number(shiftId),
        oldVal: oldShift,
        newVal: restored,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 shifts restore):", error);
    }

    return restored;
  }

  async getAssignments(companyId, query) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;
    const filters = {
      employee_id: query.employee_id,
      shift_mode: query.shift_mode,
    };

    const assignments = await ShiftModel.findAssignments(
      companyId,
      filters,
      limit,
      offset,
    );
    const total = await ShiftModel.countAssignments(companyId, filters);

    return {
      assignments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAssignmentById(companyId, assignmentId) {
    const assignment = await ShiftModel.findAssignmentById(
      assignmentId,
      companyId,
    );
    if (!assignment) {
      throw new AppError("ไม่พบ assignment", 404);
    }
    return assignment;
  }

  async createAssignment(user, payload, ipAddress) {
    const companyId = user.company_id;
    const employeeId = Number(payload.employee_id);
    const shiftMode = payload.shift_mode;
    const effectiveFrom = payload.effective_from;
    let shiftId = payload.shift_id ?? null;

    if (!employeeId || !shiftMode || !effectiveFrom) {
      throw new AppError(
        "กรุณาระบุ employee_id, shift_mode และ effective_from",
        400,
      );
    }
    if (!["normal", "custom"].includes(shiftMode)) {
      throw new AppError("shift_mode ต้องเป็น normal หรือ custom", 400);
    }

    await this.ensureEmployeeInCompany(companyId, employeeId);

    if (shiftMode === "normal") {
      if (!shiftId) {
        throw new AppError("shift_mode = normal ต้องระบุ shift_id", 400);
      }
      await this.ensureShiftInCompany(companyId, shiftId);
    } else {
      shiftId = null;
    }

    const activeAssignment = await ShiftModel.findActiveAssignmentByEmployee(
      employeeId,
      companyId,
    );

    if (activeAssignment && effectiveFrom <= activeAssignment.effective_from) {
      throw new AppError(
        "effective_from ใหม่ต้องมากกว่า effective_from ของ assignment ปัจจุบัน",
        400,
      );
    }

    const connection = await db.getConnection();
    let createdId;

    try {
      await connection.beginTransaction();

      if (activeAssignment) {
        const closeDate = new Date(effectiveFrom);
        closeDate.setDate(closeDate.getDate() - 1);
        const closeDateStr = closeDate.toISOString().split("T")[0];

        await ShiftModel.closeActiveAssignmentTx(
          connection,
          activeAssignment.id,
          closeDateStr,
        );
      }

      createdId = await ShiftModel.createAssignmentTx(connection, {
        company_id: companyId,
        employee_id: employeeId,
        shift_mode: shiftMode,
        shift_id: shiftId,
        effective_from: effectiveFrom,
        effective_to: null,
        created_by: user.id,
      });

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const created = await ShiftModel.findAssignmentById(createdId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "INSERT",
        table: "employee_shift_assignments",
        recordId: createdId,
        oldVal: activeAssignment,
        newVal: created,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 assignments create):", error);
    }

    return created;
  }

  async updateAssignment(user, assignmentId, payload, ipAddress) {
    const companyId = user.company_id;
    const oldAssignment = await ShiftModel.findAssignmentById(
      assignmentId,
      companyId,
    );
    if (!oldAssignment) {
      throw new AppError("ไม่พบ assignment", 404);
    }

    const cleanData = this.filterFields(
      payload,
      ShiftService.ALLOWED_ASSIGNMENT_FIELDS,
    );

    if (
      cleanData.shift_mode &&
      !["normal", "custom"].includes(cleanData.shift_mode)
    ) {
      throw new AppError("shift_mode ต้องเป็น normal หรือ custom", 400);
    }

    const nextShiftMode = cleanData.shift_mode || oldAssignment.shift_mode;
    let nextShiftId = oldAssignment.shift_id;
    if (cleanData.shift_id !== undefined) {
      nextShiftId = cleanData.shift_id;
    }

    if (nextShiftMode === "normal") {
      if (!nextShiftId) {
        throw new AppError("shift_mode = normal ต้องมี shift_id", 400);
      }
      await this.ensureShiftInCompany(companyId, nextShiftId);
    }

    if (nextShiftMode === "custom") {
      cleanData.shift_id = null;
    }

    await ShiftModel.updateAssignment(assignmentId, companyId, cleanData);
    const updated = await ShiftModel.findAssignmentById(
      assignmentId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "employee_shift_assignments",
        recordId: Number(assignmentId),
        oldVal: oldAssignment,
        newVal: updated,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 assignments update):", error);
    }

    return updated;
  }

  async deleteAssignment(user, assignmentId, ipAddress) {
    const companyId = user.company_id;
    const oldAssignment = await ShiftModel.findAssignmentById(
      assignmentId,
      companyId,
    );
    if (!oldAssignment) {
      throw new AppError("ไม่พบ assignment", 404);
    }

    await ShiftModel.deleteAssignment(assignmentId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "DELETE",
        table: "employee_shift_assignments",
        recordId: Number(assignmentId),
        oldVal: oldAssignment,
        newVal: null,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 assignments delete):", error);
    }
  }

  async getCustomDays(companyId, query) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;
    const filters = {
      employee_id: query.employee_id,
      start_date: query.start_date,
      end_date: query.end_date,
    };

    const customDays = await ShiftModel.findCustomDays(
      companyId,
      filters,
      limit,
      offset,
    );
    const total = await ShiftModel.countCustomDays(companyId, filters);

    return {
      customDays,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCustomDayById(companyId, customDayId) {
    const customDay = await ShiftModel.findCustomDayById(
      customDayId,
      companyId,
    );
    if (!customDay) {
      throw new AppError("ไม่พบ custom day", 404);
    }
    return customDay;
  }

  async createCustomDay(user, payload, ipAddress) {
    const companyId = user.company_id;
    const employeeId = Number(payload.employee_id);
    const workDate = payload.work_date;
    const shiftId = Number(payload.shift_id);

    if (!employeeId || !workDate || !shiftId) {
      throw new AppError("กรุณาระบุ employee_id, work_date และ shift_id", 400);
    }

    await this.ensureEmployeeInCompany(companyId, employeeId);
    await this.ensureShiftInCompany(companyId, shiftId);

    const assignmentAtDate = await ShiftModel.findAssignmentAtDate(
      employeeId,
      companyId,
      workDate,
    );
    if (assignmentAtDate?.shift_mode !== "custom") {
      throw new AppError(
        "ไม่สามารถเพิ่ม custom day ได้ เนื่องจาก employee ไม่มี custom assignment ในวันที่ระบุ",
        400,
      );
    }

    const duplicate = await ShiftModel.findCustomDayByEmployeeAndDate(
      employeeId,
      workDate,
    );
    if (duplicate) {
      throw new AppError("มี custom day ของพนักงานในวันที่ระบุแล้ว", 400);
    }

    const newId = await ShiftModel.createCustomDay({
      company_id: companyId,
      employee_id: employeeId,
      work_date: workDate,
      shift_id: shiftId,
      created_by: user.id,
    });

    const created = await ShiftModel.findCustomDayById(newId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "INSERT",
        table: "employee_shift_custom_days",
        recordId: newId,
        oldVal: null,
        newVal: created,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 custom days create):", error);
    }

    return created;
  }

  async updateCustomDay(user, customDayId, payload, ipAddress) {
    const companyId = user.company_id;
    const oldCustomDay = await ShiftModel.findCustomDayById(
      customDayId,
      companyId,
    );
    if (!oldCustomDay) {
      throw new AppError("ไม่พบ custom day", 404);
    }

    const cleanData = this.filterFields(
      payload,
      ShiftService.ALLOWED_CUSTOM_DAY_FIELDS,
    );

    if (cleanData.shift_id !== undefined) {
      await this.ensureShiftInCompany(companyId, cleanData.shift_id);
    }

    const newWorkDate = cleanData.work_date || oldCustomDay.work_date;
    const assignmentAtDate = await ShiftModel.findAssignmentAtDate(
      oldCustomDay.employee_id,
      companyId,
      newWorkDate,
    );

    if (assignmentAtDate?.shift_mode !== "custom") {
      throw new AppError(
        "ไม่สามารถอัปเดต custom day ได้ เนื่องจาก employee ไม่มี custom assignment ในวันที่ระบุ",
        400,
      );
    }

    if (cleanData.work_date && cleanData.work_date !== oldCustomDay.work_date) {
      const duplicate = await ShiftModel.findCustomDayByEmployeeAndDate(
        oldCustomDay.employee_id,
        cleanData.work_date,
      );
      if (duplicate) {
        throw new AppError("มี custom day ของพนักงานในวันที่ระบุแล้ว", 400);
      }
    }

    await ShiftModel.updateCustomDay(customDayId, companyId, cleanData);
    const updated = await ShiftModel.findCustomDayById(customDayId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "employee_shift_custom_days",
        recordId: Number(customDayId),
        oldVal: oldCustomDay,
        newVal: updated,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 custom days update):", error);
    }

    return updated;
  }

  async deleteCustomDay(user, customDayId, ipAddress) {
    const companyId = user.company_id;
    const oldCustomDay = await ShiftModel.findCustomDayById(
      customDayId,
      companyId,
    );
    if (!oldCustomDay) {
      throw new AppError("ไม่พบ custom day", 404);
    }

    await ShiftModel.deleteCustomDay(customDayId, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "DELETE",
        table: "employee_shift_custom_days",
        recordId: Number(customDayId),
        oldVal: oldCustomDay,
        newVal: null,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 custom days delete):", error);
    }
  }
}

module.exports = new ShiftService();
