const UserModel = require("./user.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// User Service
class UserService {
  // ==============================================================
  // ดึงรายชื่อผู้ใช้ทั้งหมดพร้อมสถิติ
  async getUsers(companyId) {
    const [users, stats] = await Promise.all([
      UserModel.findAll(companyId),
      UserModel.getStats(companyId),
    ]);

    return { users, stats };
  }

  // ==============================================================
  // อัปเดตบทบาทของผู้ใช้
  async updateUserRole(companyId, userId, newRole, adminUser) {
    // ตรวจสอบว่าผู้ใช้มีอยู่จริงและอยู่ในบริษัทเดียวกัน
    const user = await UserModel.findById(companyId, userId);
    if (!user) {
      throw new AppError("ไม่พบผู้ใช้งาน", 404);
    }

    // ป้องกันการเปลี่ยนบทบาท super_admin
    if (user.role === "super_admin") {
      throw new AppError("ไม่สามารถเปลี่ยนบทบาทของ Super Admin ได้", 403);
    }

    // ตรวจสอบ role ที่อนุญาต
    const allowedRoles = ["admin", "manager"];
    if (!allowedRoles.includes(newRole)) {
      throw new AppError("บทบาทที่ระบุไม่ถูกต้อง", 400);
    }

    const oldData = { role: user.role };
    const updated = await UserModel.updateRole(companyId, userId, newRole);

    if (!updated) {
      throw new AppError("ไม่สามารถอัปเดตบทบาทได้", 500);
    }

    // บันทึก Audit Trail
    await auditRecord({
      userId: adminUser.id,
      companyId,
      action: "UPDATE",
      table: "users",
      recordId: userId,
      oldVal: oldData,
      newVal: { role: newRole },
    });

    return await UserModel.findById(companyId, userId);
  }

  // ==============================================================
  // สลับสถานะผู้ใช้ (active ↔ suspended)
  async toggleUserStatus(companyId, userId, adminUser) {
    // ตรวจสอบว่าผู้ใช้มีอยู่จริง
    const user = await UserModel.findById(companyId, userId);
    if (!user) {
      throw new AppError("ไม่พบผู้ใช้งาน", 404);
    }

    // ป้องกันการระงับ super_admin
    if (user.role === "super_admin") {
      throw new AppError("ไม่สามารถระงับ Super Admin ได้", 403);
    }

    // ป้องกันการระงับตัวเอง
    if (user.id === adminUser.id) {
      throw new AppError("ไม่สามารถระงับบัญชีตัวเองได้", 400);
    }

    const newIsActive = user.is_active ? 0 : 1;
    const oldData = { is_active: user.is_active };

    const updated = await UserModel.toggleActive(
      companyId,
      userId,
      newIsActive,
    );

    if (!updated) {
      throw new AppError("ไม่สามารถเปลี่ยนสถานะได้", 500);
    }

    // บันทึก Audit Trail
    await auditRecord({
      userId: adminUser.id,
      companyId,
      action: "UPDATE",
      table: "users",
      recordId: userId,
      oldVal: oldData,
      newVal: { is_active: newIsActive },
    });

    return await UserModel.findById(companyId, userId);
  }
}

module.exports = new UserService();
