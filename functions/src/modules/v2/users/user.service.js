const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const UserModel = require("./user.model");

class UserService {
  static ALLOWED_UPDATE_FIELDS = new Set([
    "email",
    "role",
    "is_active",
    "employee_id",
    "password",
  ]);

  filterAllowedFields(payload) {
    const filtered = {};
    Object.keys(payload || {}).forEach((key) => {
      if (UserService.ALLOWED_UPDATE_FIELDS.has(key)) {
        filtered[key] = payload[key];
      }
    });

    return filtered;
  }

  async getAllUsers(companyId, query) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;
    const search = query.search?.trim() || "";

    const users = await UserModel.findAllByCompanyId(
      companyId,
      limit,
      offset,
      search,
    );
    const total = await UserModel.countAllByCompanyId(companyId, search);

    return {
      users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOverview(companyId, query = {}) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 1000), 1), 1000);
    const offset = (page - 1) * limit;
    const search = query.search?.trim() || "";

    const [users, total, stats] = await Promise.all([
      UserModel.findAllByCompanyId(companyId, limit, offset, search),
      UserModel.countAllByCompanyId(companyId, search),
      UserModel.getOverviewStats(companyId),
    ]);

    return {
      users,
      stats: {
        total_users: Number(stats.total_users || 0),
        active_users: Number(stats.active_users || 0),
        inactive_users: Number(stats.inactive_users || 0),
        admin_count: Number(stats.admin_count || 0),
        manager_count: Number(stats.manager_count || 0),
        super_admin_count: Number(stats.super_admin_count || 0),
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateRole(user, userId, payload, ip) {
    const filteredPayload = this.filterAllowedFields(payload);

    // ตรวจสอบว่าผู้ใช้มีอยู่จริง
    const users = await UserModel.findByIdAndCompanyId(userId, user.company_id);

    if (!users) {
      throw new AppError("User not found", 404);
    }

    // ป้องกันการแก้ไข role ของ super_admin
    if (users.role === "super_admin") {
      throw new AppError("ไม่สามารถแก้ไข Role ของ Super Admin ได้", 403);
    }

    // ตรวจสอบ role ที่อนุญาต
    const allowedRoles = ["admin", "manager"];
    if (!allowedRoles.includes(payload.role)) {
      throw new AppError("บทบาทที่ระบุไม่ถูกต้อง", 400);
    }

    const updatedRole = await UserModel.updateRole(
      userId,
      user.company_id,
      filteredPayload,
    );

    auditRecord({
      userId: user.id,
      companyId: user.company_id,
      action: "UPDATE",
      table: "users",
      recordId: Number(userId),
      oldVal: users,
      newVal: { ...users, role: filteredPayload.role },
      ipAddress: ip,
    });

    return updatedRole;
  }

  async updateStatus(user, userId, payload, ip) {
    const filteredPayload = this.filterAllowedFields(payload);

    // ตรวจสอบว่าผู้ใช้มีอยู่จริง
    const users = await UserModel.findByIdAndCompanyId(userId, user.company_id);

    if (!users) {
      throw new AppError("User not found", 404);
    }

    // ป้องกันการระงับ super_admin
    if (users.role === "super_admin") {
      throw new AppError("ไม่สามารถระงับ Super Admin ได้", 403);
    }

    // ป้องกันการระงับตัวเอง
    if (users.id === userId) {
      throw new AppError("ไม่สามารถระงับบัญชีตัวเองได้", 400);
    }

    const newStatus = filteredPayload.is_active ? 1 : 0;
    const oldUser = await UserModel.findByIdAndCompanyId(
      userId,
      user.company_id,
    );

    const updatedStatus = await UserModel.updateStatus(
      userId,
      user.company_id,
      newStatus,
    );

    if (!updatedStatus) {
      throw new AppError("ไม่สามารถเปลี่ยนสถานะได้", 500);
    }

    auditRecord({
      userId: user.id,
      companyId: user.company_id,
      action: "UPDATE",
      table: "users",
      recordId: Number(userId),
      oldVal: oldUser,
      newVal: { ...oldUser, is_active: newStatus },
      ipAddress: ip,
    });

    return updatedStatus;
  }
}

module.exports = new UserService();
