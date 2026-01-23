const BranchModel = require("./branch.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// Branch Service
class BranchService {
  // ==============================================================
  // สร้างสาขาใหม่
  async createBranch(user, branchData, ipAddress) {
    const companyId = user.company_id;
    const { company_id, ...cleanData } = branchData; // Prevent company_id injection

    const dataToCreate = {
      ...cleanData,
      company_id: companyId,
    };

    // Check duplicate branch_name
    if (cleanData.branch_name) {
      const existingBranch = await BranchModel.findByName(
        cleanData.branch_name,
        companyId,
      );
      if (existingBranch) {
        throw new AppError(
          `สาขาชื่อ '${cleanData.branch_name}' นี้มีอยู่ในระบบแล้ว`,
          400,
        );
      }
    }

    const newBranchId = await BranchModel.create(dataToCreate);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "INSERT",
        table: "branches",
        recordId: newBranchId,
        oldVal: null,
        newVal: dataToCreate,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return { id: newBranchId, ...dataToCreate };
  }

  // ==============================================================
  // ดึงข้อมูลสาขาทั้งหมด
  async getAllBranches(companyId, query) {
    const { page = 1, limit = 20, search } = query;
    const offset = (page - 1) * limit;

    const filters = { search };

    const branches = await BranchModel.findAll(
      companyId,
      filters,
      Number(limit),
      Number(offset),
    );
    const total = await BranchModel.countAll(companyId, filters);

    return {
      branches,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================
  // ดึงข้อมูลสาขาคนเดียวตาม ID
  async getBranchById(companyId, id) {
    const branch = await BranchModel.findById(id, companyId);
    if (!branch) {
      throw new AppError("ไม่พบข้อมูลสาขา", 404);
    }
    return branch;
  }

  // ==============================================================
  // อัปเดตข้อมูลสาขา
  async updateBranch(user, id, updateData, ipAddress) {
    const companyId = user.company_id;

    const oldBranch = await BranchModel.findById(id, companyId);
    if (!oldBranch) {
      throw new AppError("ไม่พบข้อมูลสาขาที่ต้องการแก้ไข", 404);
    }

    // Check Duplicate branch_name if changing
    if (
      updateData.branch_name &&
      updateData.branch_name !== oldBranch.branch_name
    ) {
      const existingBranch = await BranchModel.findByName(
        updateData.branch_name,
        companyId,
      );
      if (existingBranch) {
        throw new AppError(
          `สาขาชื่อ '${updateData.branch_name}' นี้มีอยู่ในระบบแล้ว`,
          400,
        );
      }
    }

    // Protect immutable fields
    delete updateData.id;
    delete updateData.company_id;
    delete updateData.deleted_at;

    await BranchModel.update(id, companyId, updateData);

    const newBranch = { ...oldBranch, ...updateData };
    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "branches",
        recordId: id,
        oldVal: oldBranch,
        newVal: newBranch,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return newBranch;
  }

  // ==============================================================
  // ลบสาขา
  async deleteBranch(user, id, ipAddress) {
    const companyId = user.company_id;

    const oldBranch = await BranchModel.findById(id, companyId);
    if (!oldBranch) {
      throw new AppError("ไม่พบข้อมูลสาขา", 404);
    }

    await BranchModel.softDelete(id, companyId);

    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "DELETE",
        table: "branches",
        recordId: id,
        oldVal: oldBranch,
        newVal: { deleted_at: new Date() },
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }
  }
}

module.exports = new BranchService();
