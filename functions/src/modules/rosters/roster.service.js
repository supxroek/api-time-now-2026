const RosterModel = require("./roster.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// Roster Service
class RosterService {
  // ==============================================================
  // สร้างตารางเวร (Individual)
  async createRoster(user, rosterData, ipAddress) {
    const companyId = user.company_id;
    const { id, ...cleanData } = rosterData;

    // ตรวจสอบความถูกต้องของ employee_id และ shift_id ว่ามีอยู่ในระบบหรือไม่
    if (cleanData.employee_id) {
      const employee = await RosterModel.findEmployeeById(
        cleanData.employee_id,
        companyId,
      );
      if (!employee) {
        throw new AppError(
          `ไม่พบพนักงานที่มี ID ${cleanData.employee_id} ในระบบ`,
          400,
        );
      }
    }
    if (cleanData.shift_id) {
      const shift = await RosterModel.findShiftById(
        cleanData.shift_id,
        companyId,
      );
      if (!shift) {
        throw new AppError(
          `ไม่พบกะการทำงานที่มี ID ${cleanData.shift_id} ในระบบ`,
          400,
        );
      }
    }

    // ตรวจสอบความซ้ำซ้อนของตารางเวร (Employee + Work Date)
    if (cleanData.employee_id && cleanData.work_date) {
      const existing = await RosterModel.findByEmployeeAndDate(
        cleanData.employee_id,
        cleanData.work_date,
      );
      if (existing) {
        throw new AppError(
          `ตารางเวรสำหรับพนักงาน ID ${cleanData.employee_id} วันที่ ${cleanData.work_date} มีอยู่แล้ว`,
          400,
        );
      }
    }

    const dataToCreate = {
      ...cleanData,
      is_ot_allowed:
        cleanData.is_ot_allowed === undefined ? 0 : cleanData.is_ot_allowed,
    };

    if (dataToCreate.leave_hours_data) {
      dataToCreate.leave_hours_data = JSON.stringify(
        dataToCreate.leave_hours_data,
      );
    }

    const newRosterId = await RosterModel.create(dataToCreate);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "INSERT",
        table: "rosters",
        recordId: newRosterId,
        oldVal: null,
        newVal: dataToCreate,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return { id: newRosterId, ...dataToCreate };
  }

  // ==============================================================
  // ดึงข้อมูลตารางเวรทั้งหมด
  async getAllRosters(companyId, query) {
    const { page = 1, limit = 50, start_date, end_date, employee_id } = query;
    const offset = (page - 1) * limit;

    const filters = { start_date, end_date, employee_id };

    const rosters = await RosterModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await RosterModel.countAll(companyId, filters);

    return {
      rosters,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // ดึงข้อมูลตารางเวรตาม ID
  async getRosterById(companyId, id) {
    const roster = await RosterModel.findById(id, companyId);
    if (!roster) {
      throw new AppError("ไม่พบข้อมูลตารางเวร", 404);
    }
    return roster;
  }

  // ==============================================================
  // อัปเดตข้อมูลตารางเวร
  async updateRoster(user, id, updateData, ipAddress) {
    const companyId = user.company_id;

    const oldRoster = await RosterModel.findById(id, companyId);
    if (!oldRoster) {
      throw new AppError("ไม่พบข้อมูลตารางเวรที่ต้องการแก้ไข", 404);
    }

    delete updateData.id;
    // Don't allow changing employee_id or work_date easily if it violates unique constraint - let DB throw error or check first.

    if (updateData.leave_hours_data) {
      updateData.leave_hours_data = JSON.stringify(updateData.leave_hours_data);
    }

    await RosterModel.update(id, companyId, updateData);

    const newRoster = { ...oldRoster, ...updateData };

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "rosters",
        recordId: id,
        oldVal: oldRoster,
        newVal: newRoster,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return newRoster;
  }

  // ==============================================================
  // ลบตารางเวร
  async deleteRoster(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldRoster = await RosterModel.findById(id, companyId);
    if (!oldRoster) {
      throw new AppError("ไม่พบข้อมูลตารางเวร", 404);
    }

    await RosterModel.delete(id, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "DELETE",
        table: "rosters",
        recordId: id,
        oldVal: oldRoster,
        newVal: null,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }
}

module.exports = new RosterService();
