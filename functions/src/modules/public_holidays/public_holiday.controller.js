const PublicHolidayService = require("./public_holiday.service");
const catchAsync = require("../../utils/catchAsync");

// Public Holiday Controller
class PublicHolidayController {
  // ==============================================================
  // ดึงรายชื่อวันหยุดราชการทั้งหมด
  getAll = catchAsync(async (req, res, next) => {
    const result = await PublicHolidayService.getAllPublicHolidays(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  // ==============================================================
  // อัปเดตข้อมูลวันหยุดราชการ
  update = catchAsync(async (req, res, next) => {
    const updatedHoliday = await PublicHolidayService.updatePublicHoliday(
      req.user,
      req.params.id,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      data: { holiday: updatedHoliday },
    });
  });
}

module.exports = new PublicHolidayController();
