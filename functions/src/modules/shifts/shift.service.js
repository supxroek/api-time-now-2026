const ShiftModel = require("./shift.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// Shift Service
class ShiftService {
  // ==============================================================
  // Validate shift times
  validateShiftTimes(cleanData) {
    if (
      !cleanData.start_time &&
      !cleanData.end_time &&
      !cleanData.break_start_time &&
      !cleanData.break_end_time
    ) {
      return;
    }

    // Validate shift start and end times
    if (
      cleanData.start_time &&
      cleanData.end_time &&
      !cleanData.is_night_shift &&
      cleanData.start_time >= cleanData.end_time
    ) {
      throw new AppError(
        "เวลาเริ่มต้นกะการทำงานต้องน้อยกว่าเวลาสิ้นสุดกะการทำงาน",
        400,
      );
    }

    // Validate break times
    if (
      cleanData.is_break &&
      !cleanData.is_night_shift &&
      cleanData.break_start_time &&
      cleanData.break_end_time &&
      cleanData.break_start_time >= cleanData.break_end_time
    ) {
      throw new AppError(
        "เวลาเริ่มต้นช่วงพักต้องน้อยกว่าเวลาสิ้นสุดช่วงพัก",
        400,
      );
    }
  }

  // ==============================================================
  // สร้างกะการทำงานใหม่
  async createShift(user, shiftData, ipAddress) {
    const companyId = user.company_id;
    // Extract company_id out (if present) so we use the user's company_id
    const { id, company_id, ...cleanData } = shiftData;

    // Check Duplicate Shift Name
    if (cleanData.name) {
      const existingShift = await ShiftModel.findByName(
        cleanData.name,
        companyId,
      );
      if (existingShift) {
        throw new AppError(
          `ชื่อกะการทำงาน '${cleanData.name}' นี้มีอยู่ในระบบแล้ว`,
          400,
        );
      }
    }

    // Validate shift times
    this.validateShiftTimes(cleanData);

    const dataToCreate = {
      ...cleanData,
      company_id: companyId,
      // Default values handling if not provided in payload (DB has defaults, but safe to set)
      type: cleanData.type || "fixed",
      is_break: cleanData.is_break === undefined ? 1 : cleanData.is_break,
      is_night_shift:
        cleanData.is_night_shift === undefined ? 0 : cleanData.is_night_shift,
    };

    // Force break times to null if no break
    if (!dataToCreate.is_break) {
      dataToCreate.break_start_time = null;
      dataToCreate.break_end_time = null;
    }

    const newShiftId = await ShiftModel.create(dataToCreate);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "INSERT",
        table: "shifts",
        recordId: newShiftId,
        oldVal: null,
        newVal: dataToCreate,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return { id: newShiftId, ...dataToCreate };
  }

  // ==============================================================
  // ดึงข้อมูลกะการทำงานทั้งหมด
  async getAllShifts(companyId, query) {
    const { page = 1, limit = 20, search, type } = query;
    const offset = (page - 1) * limit;

    const filters = { search, type };

    const shifts = await ShiftModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await ShiftModel.countAll(companyId, filters);

    return {
      shifts,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // ดึงข้อมูลกะการทำงานตาม ID
  async getShiftById(companyId, id) {
    const shift = await ShiftModel.findById(id, companyId);
    if (!shift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงาน", 404);
    }
    return shift;
  }

  // ==============================================================
  // อัปเดตข้อมูลกะการทำงาน
  async updateShift(user, id, updateData, ipAddress) {
    const companyId = user.company_id;

    const oldShift = await ShiftModel.findById(id, companyId);
    if (!oldShift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงานที่ต้องการแก้ไข", 404);
    }

    delete updateData.id;
    delete updateData.company_id;

    // Force break times to null if is_break is explicitly false
    if (updateData.is_break === false || updateData.is_break === 0) {
      updateData.break_start_time = null;
      updateData.break_end_time = null;
    }

    await ShiftModel.update(id, companyId, updateData);

    const newShift = { ...oldShift, ...updateData };

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "shifts",
        recordId: id,
        oldVal: oldShift,
        newVal: newShift,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return newShift;
  }

  // ==============================================================
  // ลบกะการทำงาน (soft delete)
  async softDeleteShift(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldShift = await ShiftModel.findById(id, companyId);
    if (!oldShift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงาน", 404);
    }

    // Check if shift is used by any employee?
    // DB has constraint employees_ibfk_4: foreign key (default_shift_id) references shifts (id) on delete set null
    // So it is safe to delete, employees will have default_shift_id set to NULL.

    await ShiftModel.softDelete(id, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "DELETE",
        table: "shifts",
        recordId: id,
        oldVal: oldShift,
        newVal: { ...oldShift, deleted_at: new Date() },
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }

  // ==============================================================
  // ลบกะการทำงาน
  async deleteShift(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldShift = await ShiftModel.findById(id, companyId);
    if (!oldShift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงาน", 404);
    }

    await ShiftModel.delete(id, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "DELETE",
        table: "shifts",
        recordId: id,
        oldVal: oldShift,
        newVal: null,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }

  // ==============================================================
  // ดึงรายชื่อกะการทำงานเฉพาะที่ถูกลบแบบ soft delete
  async getDeletedShifts(companyId, query) {
    const { page = 1, limit = 20, search, type } = query;
    const offset = (page - 1) * limit;
    const filters = { search, type };

    const shifts = await ShiftModel.findAllDeleted(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await ShiftModel.countAllDeleted(companyId, filters);

    return {
      shifts,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // กู้คืนกะการทำงานที่ถูกลบแบบ soft delete
  async restoreShift(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldShift = await ShiftModel.findDeletedById(id, companyId);

    if (!oldShift) {
      throw new AppError("ไม่พบข้อมูลกะการทำงานที่ถูกลบ", 404);
    }

    await ShiftModel.restore(id, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "shifts",
        recordId: id,
        oldVal: oldShift,
        newVal: { ...oldShift, deleted_at: null },
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }
}

module.exports = new ShiftService();
