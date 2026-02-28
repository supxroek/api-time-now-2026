const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AppError = require("../../../utils/AppError");
const AuthModel = require("./auth.model");

class AuthService {
  static ROLE_LABELS = {
    super_admin: "ผู้ดูแลระบบสูงสุด",
    admin: "ผู้ดูแลระบบ",
    manager: "ผู้จัดการ",
  };

  toEnumObject(key, labels) {
    if (!key) return null;
    return {
      key,
      label: labels[key] || key,
    };
  }

  buildExpiresAtFromEnv() {
    const rawValue = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
    const refreshExpireRegex = /^(\d+)([dhm])$/i;
    const match = refreshExpireRegex.exec(String(rawValue).trim());

    const expiresAt = new Date();

    if (!match) {
      expiresAt.setDate(expiresAt.getDate() + 7);
      return expiresAt;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === "d") {
      expiresAt.setDate(expiresAt.getDate() + amount);
      return expiresAt;
    }

    if (unit === "h") {
      expiresAt.setHours(expiresAt.getHours() + amount);
      return expiresAt;
    }

    expiresAt.setMinutes(expiresAt.getMinutes() + amount);
    return expiresAt;
  }

  signAccessToken(user) {
    return jwt.sign(
      {
        user_id: user.id,
        company_id: user.company_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );
  }

  signRefreshToken(userId) {
    return jwt.sign({ user_id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    });
  }

  mapUser(user) {
    return {
      id: user.id,
      company_id: user.company_id,
      employee_id: user.employee_id,
      email: user.email,
      role: this.toEnumObject(user.role, AuthService.ROLE_LABELS),
      is_active: Boolean(user.is_active),
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
      employee: user.employee_id
        ? {
            id: user.employee_id,
            name: user.employee_name,
            code: user.employee_code,
            avatar: user.employee_avatar,
          }
        : null,
    };
  }

  async login(email, password) {
    const user = await AuthModel.findUserByEmail(email);
    if (!user) {
      throw new AppError("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401);
    }

    const isMatched = await bcrypt.compare(password, user.password_hash);
    if (!isMatched) {
      throw new AppError("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401);
    }

    if (user.is_active !== 1) {
      throw new AppError("บัญชีของคุณถูกระงับการใช้งาน", 403);
    }

    await AuthModel.updateLastLogin(user.id);

    const accessToken = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user.id);
    const refreshTokenExpiresAt = this.buildExpiresAtFromEnv();

    await AuthModel.createRefreshToken(
      user.id,
      refreshToken,
      refreshTokenExpiresAt,
    );

    const profile = await AuthModel.findUserById(user.id);

    return {
      user: this.mapUser(profile || user),
      accessToken,
      refreshToken,
    };
  }

  async refreshAccessToken(refreshToken) {
    await new Promise((resolve, reject) => {
      jwt.verify(refreshToken, process.env.JWT_SECRET, (verifyError) => {
        if (verifyError) {
          reject(new AppError("Refresh Token ไม่ถูกต้องหรือหมดอายุ", 401));
          return;
        }
        resolve();
      });
    });

    const storedToken = await AuthModel.findRefreshToken(refreshToken);
    if (!storedToken) {
      throw new AppError("Refresh Token ไม่พบในระบบ", 401);
    }

    if (storedToken.is_revoked === 1) {
      throw new AppError("Refresh Token นี้ถูกยกเลิกแล้ว", 401);
    }

    if (new Date() > new Date(storedToken.expires_at)) {
      throw new AppError("Refresh Token หมดอายุการใช้งาน", 401);
    }

    if (storedToken.is_active !== 1) {
      throw new AppError("บัญชีของคุณถูกระงับการใช้งาน", 403);
    }

    await AuthModel.revokeRefreshToken(storedToken.id);

    const user = await AuthModel.findUserById(storedToken.user_id);
    if (!user) {
      throw new AppError("ไม่พบผู้ใช้งาน", 404);
    }

    const newAccessToken = this.signAccessToken(user);
    const newRefreshToken = this.signRefreshToken(user.id);
    const refreshTokenExpiresAt = this.buildExpiresAtFromEnv();

    await AuthModel.createRefreshToken(
      user.id,
      newRefreshToken,
      refreshTokenExpiresAt,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken) {
    if (!refreshToken) return;

    const storedToken = await AuthModel.findRefreshToken(refreshToken);
    if (!storedToken) return;

    await AuthModel.revokeRefreshToken(storedToken.id);
  }

  async getMyProfile(userId) {
    const user = await AuthModel.findUserById(userId);
    if (!user) {
      throw new AppError("ไม่พบผู้ใช้งาน", 404);
    }

    if (user.is_active !== 1) {
      throw new AppError("บัญชีของคุณถูกระงับการใช้งาน", 403);
    }

    return this.mapUser(user);
  }
}

module.exports = new AuthService();
