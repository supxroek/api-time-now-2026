const catchAsync = require("../../../utils/catchAsync");
const AppError = require("../../../utils/AppError");
const AuthService = require("./auth.service");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

class AuthController {
  login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError("กรุณาระบุ email และ password", 400));
    }

    const { user, accessToken, refreshToken } = await AuthService.login(
      email,
      password,
    );

    res.cookie("refreshToken", refreshToken, cookieOptions);

    res.status(200).json({
      status: "success",
      token: accessToken,
      data: { user },
    });
  });

  refreshToken = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return next(new AppError("ไม่พบ Refresh Token", 401));
    }

    const tokens = await AuthService.refreshAccessToken(refreshToken);

    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

    res.status(200).json({
      status: "success",
      token: tokens.accessToken,
    });
  });

  logout = catchAsync(async (req, res, _next) => {
    const refreshToken = req.cookies?.refreshToken;
    await AuthService.logout(refreshToken);

    res.clearCookie("refreshToken", { ...cookieOptions, maxAge: 0 });

    res.status(200).json({
      status: "success",
      message: "ออกจากระบบเรียบร้อยแล้ว",
    });
  });

  me = catchAsync(async (req, res, _next) => {
    const user = await AuthService.getMyProfile(req.user.id);

    res.status(200).json({
      status: "success",
      data: { user },
    });
  });

  forgotPassword = catchAsync(async (req, res, _next) => {
    const { email } = req.body;
    await AuthService.forgotPassword(email);

    res.status(200).json({
      status: "success",
      message:
        "หากอีเมลนี้มีอยู่ในระบบ เราจะส่งคำแนะนำในการรีเซ็ตรหัสผ่านให้คุณทางอีเมล",
    });
  });

  resetPassword = catchAsync(async (req, res, next) => {
    const token = req.body?.token || req.query?.token;
    const newPassword = req.body?.newPassword || req.body?.password;

    if (!token) {
      return next(new AppError("ไม่พบ Token สำหรับรีเซ็ตรหัสผ่าน", 400));
    }

    if (!newPassword) {
      return next(new AppError("กรุณาระบุรหัสผ่านใหม่", 400));
    }

    await AuthService.resetPassword(token, newPassword);

    res.status(200).json({
      status: "success",
      message:
        "รีเซ็ตรหัสผ่านเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที",
    });
  });

  validateResetPasswordLink = catchAsync(async (req, res, next) => {
    const token = req.query?.token;

    if (!token) {
      return next(new AppError("ไม่พบ Token สำหรับรีเซ็ตรหัสผ่าน", 400));
    }

    const result = await AuthService.validateResetPasswordLink(token);

    res.status(200).json({
      status: "success",
      data: result,
    });
  });
}

module.exports = new AuthController();
