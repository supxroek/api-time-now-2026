const catchAsync = require("../../../utils/catchAsync");
const RosterV2Service = require("./roster.service");

class RosterV2Controller {
  getOverview = catchAsync(async (req, res, _next) => {
    const result = await RosterV2Service.getOverview(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });
}

module.exports = new RosterV2Controller();
