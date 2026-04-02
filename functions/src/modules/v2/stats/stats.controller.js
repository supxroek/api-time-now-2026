const catchAsync = require("../../../utils/catchAsync");
const StatsService = require("./stats.service");

class StatsController {
  getOverview = catchAsync(async (req, res, _next) => {
    const overview = await StatsService.getOverview(req.user.company_id);

    res.status(200).json({
      status: "success",
      data: overview,
    });
  });
}

module.exports = new StatsController();
