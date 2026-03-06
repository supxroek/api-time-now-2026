const catchAsync = require("../../../utils/catchAsync");
const RosterManageV2Service = require("./roster_manage.service");

class RosterManageV2Controller {
  getOverview = catchAsync(async (req, res) => {
    const result = await RosterManageV2Service.getOverview(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  bulkSave = catchAsync(async (req, res) => {
    const result = await RosterManageV2Service.bulkSave(
      req.user.company_id,
      req.user,
      req.body,
      req.ip,
    );

    res.status(200).json({
      status: "success",
      message: "บันทึกข้อมูล roster-manage สำเร็จ",
      data: result,
    });
  });
}

module.exports = new RosterManageV2Controller();
