const PublicHolidayModel = require("./public_holiday.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

class PublicHolidayService {
  // ==============================================================
  // ดึงรายชื่อวันหยุดราชการทั้งหมด
  async getAllPublicHolidays(companyId, query) {
    const { page = 1, limit = 50, year, month, search } = query;
    const offset = (page - 1) * limit;

    const filters = { year, month, search };

    const holidays = await PublicHolidayModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await PublicHolidayModel.countAll(companyId, filters);

    return {
      holidays,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // อัปเดตข้อมูลวันหยุดราชการ
  async updatePublicHoliday(user, id, updateData, ipAddress) {
    const companyId = user.company_id;

    const oldHoliday = await PublicHolidayModel.findById(id, companyId);
    if (!oldHoliday) {
      throw new AppError("ไม่พบข้อมูลวันหยุด", 404);
    }

    const { company_id, ...cleanData } = updateData;

    // If date changes, check duplicate
    if (
      cleanData.holiday_date &&
      cleanData.holiday_date !== oldHoliday.holiday_date
    ) {
      // Note: Dates from DB might be object or string, assume string comparison ok if standardized.
      // If generic date type, safe to query.
      const existing = await PublicHolidayModel.findByDate(
        cleanData.holiday_date,
        companyId,
      );
      if (existing && existing.id != id) {
        throw new AppError("วันนี้เป็นวันหยุดในระบบแล้ว", 400);
      }
    }

    if (cleanData.hasOwnProperty("is_compensatory")) {
      cleanData.is_compensatory = cleanData.is_compensatory ? 1 : 0;
    }

    if (Object.keys(cleanData).length === 0) return oldHoliday;

    await PublicHolidayModel.update(id, companyId, cleanData);

    const newHoliday = { ...oldHoliday, ...cleanData };

    // Audit
    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "public_holidays",
        recordId: id,
        oldVal: oldHoliday,
        newVal: newHoliday,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return newHoliday;
  }
}

module.exports = new PublicHolidayService();
