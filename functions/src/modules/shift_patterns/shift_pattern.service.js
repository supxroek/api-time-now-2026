const ShiftPatternModel = require("./shift_pattern.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// Shift Pattern Service
class ShiftPatternService {
  // ==============================================================
  // สร้างรูปแบบกะการทำงาน
  async createShiftPattern(user, patternData, ipAddress) {
    const companyId = user.company_id;
    const { id, company_id, ...cleanData } = patternData;

    // Normalize pattern_data if it's an object/array, ensure it's stored as JSON string if DB needs string,
    // but the driver usually handles object -> JSON for JSON columns.
    // However, if cleanData.pattern_data is object, MySQL driver will usually stringify it.

    const dataToCreate = {
      ...cleanData,
      company_id: companyId,
      pattern_data: JSON.stringify(cleanData.pattern_data || {}),
    };

    const newPatternId = await ShiftPatternModel.create(dataToCreate);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "INSERT",
        table: "shift_patterns",
        recordId: newPatternId,
        oldVal: null,
        newVal: dataToCreate,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return { id: newPatternId, ...dataToCreate };
  }

  // ==============================================================
  // ดึงข้อมูลรูปแบบกะการทำงานทั้งหมด
  async getAllShiftPatterns(companyId, query) {
    const { page = 1, limit = 20, search } = query;
    const offset = (page - 1) * limit;

    const filters = { search };

    const patterns = await ShiftPatternModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await ShiftPatternModel.countAll(companyId, filters);

    return {
      patterns,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // ดึงข้อมูลรูปแบบกะการทำงานตาม ID
  async getShiftPatternById(companyId, id) {
    const pattern = await ShiftPatternModel.findById(id, companyId);
    if (!pattern) {
      throw new AppError("ไม่พบข้อมูลรูปแบบกะการทำงาน", 404);
    }
    return pattern;
  }

  // ==============================================================
  // อัปเดตข้อมูลรูปแบบกะการทำงาน
  async updateShiftPattern(user, id, updateData, ipAddress) {
    const companyId = user.company_id;

    const oldPattern = await ShiftPatternModel.findById(id, companyId);
    if (!oldPattern) {
      throw new AppError("ไม่พบข้อมูลรูปแบบกะการทำงานที่ต้องการแก้ไข", 404);
    }

    delete updateData.id;
    delete updateData.company_id;

    if (updateData.pattern_data) {
      updateData.pattern_data = JSON.stringify(updateData.pattern_data);
    }

    await ShiftPatternModel.update(id, companyId, updateData);

    const newPattern = { ...oldPattern, ...updateData };

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "shift_patterns",
        recordId: id,
        oldVal: oldPattern,
        newVal: newPattern,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return newPattern;
  }

  // ==============================================================
  // ลบรูปแบบกะการทำงาน (soft delete)
  async softDeleteShiftPattern(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldPattern = await ShiftPatternModel.findById(id, companyId);
    if (!oldPattern) {
      throw new AppError("ไม่พบข้อมูลรูปแบบกะการทำงาน", 404);
    }

    await ShiftPatternModel.softDelete(id, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "DELETE",
        table: "shift_patterns",
        recordId: id,
        oldVal: oldPattern,
        newVal: { ...oldPattern, deleted_at: new Date() },
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }

  // ==============================================================
  // ลบรูปแบบกะการทำงาน
  async deleteShiftPattern(user, id, ipAddress) {
    const companyId = user.company_id;
    const oldPattern = await ShiftPatternModel.findById(id, companyId);

    if (!oldPattern) {
      throw new AppError("ไม่พบข้อมูลรูปแบบกะการทำงาน", 404);
    }

    await ShiftPatternModel.delete(id, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "DELETE",
        table: "shift_patterns",
        recordId: id,
        oldVal: oldPattern,
        newVal: null,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }

  // ==============================================================
  // ดึงรายชื่อรูปแบบกะที่ถูกลบแบบ soft delete
  async getDeletedPatterns(companyId, query) {
    const { page = 1, limit = 20, search } = query;
    const offset = (page - 1) * limit;

    const filters = { search };

    const patterns = await ShiftPatternModel.findAllDeleted(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );

    const total = await ShiftPatternModel.countAllDeleted(companyId, filters);

    return {
      patterns,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // กู้คืนรูปแบบกะที่ถูกลบแบบ soft delete
  async restoreShiftPattern(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldPattern = await ShiftPatternModel.findDeletedById(id, companyId);

    if (!oldPattern) {
      throw new AppError("ไม่พบข้อมูลรูปแบบกะการทำงานที่ถูกลบ", 404);
    }

    await ShiftPatternModel.restore(id, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "shift_patterns",
        recordId: id,
        oldVal: oldPattern,
        newVal: { ...oldPattern, deleted_at: null },
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }
}

module.exports = new ShiftPatternService();
