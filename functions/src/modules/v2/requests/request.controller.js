const catchAsync = require("../../../utils/catchAsync");
const RequestService = require("./request.service");

class RequestController {
  validateApprovalToken = catchAsync(async (req, res, _next) => {
    const token = req.query?.token;
    const result = await RequestService.validateApprovalToken(token);

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  approveByToken = catchAsync(async (req, res, _next) => {
    const token = req.body?.token || req.query?.token;
    const result = await RequestService.approveByToken(token);

    res.status(200).json({
      status: "success",
      message: result.approved
        ? "อนุมัติคำขอเรียบร้อยแล้ว"
        : "อนุมัติลำดับปัจจุบันเรียบร้อยแล้ว ระบบได้ส่งต่อไปยังลำดับถัดไป",
      data: result,
    });
  });

  rejectByToken = catchAsync(async (req, res, _next) => {
    const token = req.body?.token || req.query?.token;
    const rejectedReason = req.body?.reason;
    const result = await RequestService.rejectByToken(token, rejectedReason);

    res.status(200).json({
      status: "success",
      message: "ปฏิเสธคำขอเรียบร้อยแล้ว",
      data: result,
    });
  });

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
    const result = await RequestService.getRequestStats(req.user.company_id);

    res.status(200).json({
      status: "success",
      data: result,
    });
  });

  resendNotification = catchAsync(async (req, res, _next) => {
    const result = await RequestService.resendNotification(
      req.user.company_id,
      req.params.id,
      req.user.id,
    );

    res.status(200).json({
      status: "success",
      message: "ส่งการแจ้งเตือนซ้ำเรียบร้อยแล้ว",
      data: result,
    });
  });
}

module.exports = new RequestController();
