const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const ShiftModel = require("./shift.model");

class ShiftService {
  static ALLOWED_FIELDS = new Set([
    "name",
    "type",
    "start_time",
    "end_time",
    "is_break",
    "break_start_time",
    "break_end_time",
    "is_night_shift",
  ]);

  filterAllowedFields(payload) {
    const filtered = {};
    Object.keys(payload || {}).forEach((key) => {
      if (ShiftService.ALLOWED_FIELDS.has(key)) {
        filtered[key] = payload[key];
      }
    });

    return filtered;
  }

  normalizeData(data) {
    const normalized = { ...data };

    if (normalized.name !== undefined) {
      normalized.name = normalized.name?.trim();
    }

    if (normalized.type !== undefined) {
      normalized.type = normalized.type?.trim();
    }

    if (normalized.is_break !== undefined) {
      normalized.is_break = Number(normalized.is_break);
    }

    if (normalized.is_night_shift !== undefined) {
      normalized.is_night_shift = Number(normalized.is_night_shift);
    }

    return normalized;
  }

  validateData(data, { requireName = false } = {}) {
    if (requireName && !data.name) {
      throw new AppError("กรุณาระบุชื่อกะการทำงาน", 400);
    }

    if (data.name !== undefined && !data.name) {
      throw new AppError("กรุณาระบุชื่อกะการทำงาน", 400);
    }

    if (data.type !== undefined && !["fixed", "flexible"].includes(data.type)) {
      throw new AppError("type ต้องเป็น fixed หรือ flexible", 400);
    }

    if (data.is_break !== undefined && ![0, 1].includes(data.is_break)) {
      throw new AppError("is_break ต้องเป็น 0 หรือ 1", 400);
    }

    if (
      data.is_night_shift !== undefined &&
      ![0, 1].includes(data.is_night_shift)
    ) {
      throw new AppError("is_night_shift ต้องเป็น 0 หรือ 1", 400);
    }

    const isNightShift = data.is_night_shift ?? 0;
    if (
      isNightShift === 0 &&
      data.start_time &&
      data.end_time &&
      data.start_time >= data.end_time
    ) {
      throw new AppError("เวลาเริ่มต้นกะต้องน้อยกว่าเวลาสิ้นสุดกะ", 400);
    }

    const isBreak = data.is_break ?? 0;
    if (isBreak === 0) {
      data.break_start_time = null;
      data.break_end_time = null;
    }

    if (
      isBreak === 1 &&
      isNightShift === 0 &&
      data.break_start_time &&
      data.break_end_time &&
      data.break_start_time >= data.break_end_time
    ) {
      throw new AppError("เวลาเริ่มพักต้องน้อยกว่าเวลาสิ้นสุดพัก", 400);
    }
  }

  async createShift(user, payload, ipAddress) {
    const companyId = user.company_id;
    const cleanData = this.normalizeData(this.filterAllowedFields(payload));

    this.validateData(cleanData, { requireName: true });

    const duplicate = await ShiftModel.findByNameAndCompanyId(
      cleanData.name,
      companyId,
    );
    if (duplicate) {
      throw new AppError(
        `ชื่อกะการทำงาน '${cleanData.name}' นี้มีอยู่แล้ว`,
        400,
      );
    }

    const dataToCreate = {
      company_id: companyId,
      name: cleanData.name,
      type: cleanData.type || "fixed",
      start_time: cleanData.start_time ?? null,
      end_time: cleanData.end_time ?? null,
      is_break: cleanData.is_break ?? 0,
      break_start_time: cleanData.break_start_time ?? null,
      break_end_time: cleanData.break_end_time ?? null,
      is_night_shift: cleanData.is_night_shift ?? 0,
    };

    const newId = await ShiftModel.create(dataToCreate);
    const created = await ShiftModel.findByIdAndCompanyId(newId, companyId);

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
      search: query.search?.trim() || "",
      type: query.type,
    };

    const shifts = await ShiftModel.findAllByCompanyId(
      companyId,
      filters,
      limit,
      offset,
    );
    const total = await ShiftModel.countAllByCompanyId(companyId, filters);

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
    const shift = await ShiftModel.findByIdAndCompanyId(shiftId, companyId);
    if (!shift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงาน", 404);
    }

    return shift;
  }

  async updateShift(user, shiftId, payload, ipAddress) {
    const companyId = user.company_id;
    const oldShift = await ShiftModel.findByIdAndCompanyId(shiftId, companyId);
    if (!oldShift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงานที่ต้องการแก้ไข", 404);
    }

    const cleanData = this.normalizeData(this.filterAllowedFields(payload));
    this.validateData(cleanData, { requireName: false });

    if (cleanData.name && cleanData.name !== oldShift.name) {
      const duplicate = await ShiftModel.findByNameAndCompanyId(
        cleanData.name,
        companyId,
        Number(shiftId),
      );
      if (duplicate) {
        throw new AppError(
          `ชื่อกะการทำงาน '${cleanData.name}' นี้มีอยู่แล้ว`,
          400,
        );
      }
    }

    await ShiftModel.updateByIdAndCompanyId(shiftId, companyId, cleanData);
    const updated = await ShiftModel.findByIdAndCompanyId(shiftId, companyId);

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
    const oldShift = await ShiftModel.findByIdAndCompanyId(shiftId, companyId);
    if (!oldShift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงาน", 404);
    }

    await ShiftModel.softDeleteByIdAndCompanyId(shiftId, companyId);

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
    const oldShift = await ShiftModel.findDeletedByIdAndCompanyId(
      shiftId,
      companyId,
    );
    if (!oldShift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงานที่ถูกลบ", 404);
    }

    await ShiftModel.restoreByIdAndCompanyId(shiftId, companyId);
    const restored = await ShiftModel.findByIdAndCompanyId(shiftId, companyId);

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
}

module.exports = new ShiftService();
