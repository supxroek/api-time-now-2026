const AuthService = require("./auth.service");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");

// Cookie Options
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // ส่งเฉพาะ HTTPS ในโหมด Production
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // หมดอายุ 7 วัน
};

// Auth Controller
class AuthController {
  // ==============================================================
  // สมัครสมาชิก
  register = catchAsync(async (req, res, next) => {
    // ตรวจสอบข้อมูลที่จำเป็น
    const { email, password, company_id } = req.body;
    if (!email || !password || !company_id) {
      return next(
        new AppError("กรุณาระบุ email, password และ company_id", 400),
      );
    }

    // สมัครสมาชิก (เรียกใช้ Service)
    const newUser = await AuthService.register(req.body);

    // ตอบกลับผลลัพธ์
    res.status(201).json({
      status: "success",
      data: {
        user: newUser,
      },
    });
  });

  // ==============================================================
  // เข้าสู่ระบบ
  login = catchAsync(async (req, res, next) => {
    // ตรวจสอบข้อมูลที่จำเป็น
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError("กรุณาระบุ email และ password", 400));
    }

    // เข้าสู่ระบบ (เรียกใช้ Service)
    const { user, accessToken, refreshToken } = await AuthService.login(
      email,
      password,
    );

    // ส่ง Refresh Token ผ่าน Cookie
    res.cookie("refreshToken", refreshToken, cookieOptions);

    // ตอบกลับผลลัพธ์
    res.status(200).json({
      status: "success",
      token: accessToken, // ส่ง Access Token ใน Body
      data: {
        user,
      },
    });
  });

  // ==============================================================
  // ออกจากระบบ
  logout = catchAsync(async (req, res, next) => {
    const { refreshToken } = req.cookies;

    // ยกเลิกโทเค็นในฐานข้อมูล
    await AuthService.logout(refreshToken);

    // ล้าง Cookie
    res.clearCookie("refreshToken", { ...cookieOptions, maxAge: 0 });

    // ตอบกลับผลลัพธ์
    res.status(200).json({
      status: "success",
      message: "ออกจากระบบเรียบร้อยแล้ว",
    });
  });

  // ==============================================================
  // ขอ Access Token ใหม่
  refreshToken = catchAsync(async (req, res, next) => {
    // ดึง Refresh Token จาก Cookie
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      return next(new AppError("ไม่พบ Refresh Token", 401));
    }

    // ขอ Access Token ใหม่ (เรียกใช้ Service)
    const tokens = await AuthService.refreshToken(refreshToken);

    // อัปเดต Cookie ด้วย Refresh Token ใหม่ (Rotation)
    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

    // ตอบกลับผลลัพธ์
    res.status(200).json({
      status: "success",
      token: tokens.accessToken,
    });
  });

  // ==============================================================
  // ขอรีเซ็ตรหัสผ่าน
  forgotPassword = catchAsync(async (req, res, next) => {
    // ตรวจสอบข้อมูลที่จำเป็น
    const { email } = req.body;
    if (!email) {
      return next(new AppError("กรุณาระบุ email", 400));
    }

    // ขอรีเซ็ตรหัสผ่าน (เรียกใช้ Service)
    const result = await AuthService.forgotPassword(email);

    // ตอบกลับผลลัพธ์
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  });
}

module.exports = new AuthController();
