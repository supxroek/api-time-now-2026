const UserService = require("./user.service");
const catchAsync = require("../../utils/catchAsync");

// User Controller
class UserController {
  // ==============================================================
  // ดึงรายชื่อผู้ใช้ทั้งหมดพร้อมสถิติ
  getAll = catchAsync(async (req, res, next) => {
    const result = await UserService.getUsers(req.user.company_id);
    res.status(200).json({ status: "success", data: result });
  });

  // ==============================================================
  // อัปเดตบทบาทผู้ใช้
  updateRole = catchAsync(async (req, res, next) => {
    const { role } = req.body;
    const result = await UserService.updateUserRole(
      req.user.company_id,
      req.params.id,
      role,
      req.user,
    );
    res.status(200).json({
      status: "success",
      message: "อัปเดตบทบาทสำเร็จ",
      data: result,
    });
  });

  // ==============================================================
  // สลับสถานะผู้ใช้ (active ↔ suspended)
  toggleStatus = catchAsync(async (req, res, next) => {
    const result = await UserService.toggleUserStatus(
      req.user.company_id,
      req.params.id,
      req.user,
    );
    res.status(200).json({
      status: "success",
      message: "เปลี่ยนสถานะสำเร็จ",
      data: result,
    });
  });
}

module.exports = new UserController();
