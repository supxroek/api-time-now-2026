const catchAsync = require("../../../utils/catchAsync");
const RequestService = require("./request.service");

class RequestController {
  getList = catchAsync(async (req, res, _next) => {
    const result = await RequestService.getRequestList(
      req.user.company_id,
      req.query,
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  getOne = catchAsync(async (req, res, _next) => {
    const request = await RequestService.getRequestById(
      req.user.company_id,
      req.params.id,
    );

    res.status(200).json({
      status: "success",
      data: { request },
    });
  });

  getStats = catchAsync(async (req, res, _next) => {
    const stats = await RequestService.getRequestStats(req.user.company_id);

    res.status(200).json({
      status: "success",
      data: { stats },
    });
  });
}

module.exports = new RequestController();
