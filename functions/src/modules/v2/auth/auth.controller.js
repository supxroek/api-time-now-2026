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
}

module.exports = new AuthController();
