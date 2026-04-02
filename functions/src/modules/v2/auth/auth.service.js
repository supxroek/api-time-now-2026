const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const AppError = require("../../../utils/AppError");
const AuthModel = require("./auth.model");
const { sendMailApi } = require("../../../providers/mail.provider");

class AuthService {
  static ROLE_LABELS = {
    super_admin: "แอดมินสูงสุด",
    admin: "แอดมิน",
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

  buildPasswordVersion(passwordHash) {
    if (!passwordHash) {
      return null;
    }

    return crypto
      .createHash("sha256")
      .update(String(passwordHash))
      .digest("hex");
  }

  signResetPasswordToken(user) {
    const resetSecret = process.env.JWT_RESET_PASSWORD_SECRET;

    if (!resetSecret) {
      throw new AppError("ระบบยังไม่ได้ตั้งค่า JWT secret", 500);
    }

    return jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        purpose: "reset_password",
        pwdv: this.buildPasswordVersion(user.password_hash),
      },
      resetSecret,
      {
        expiresIn: process.env.JWT_RESET_PASSWORD_EXPIRES_IN,
      },
    );
  }

  verifyResetPasswordToken(token) {
    const resetSecret = process.env.JWT_RESET_PASSWORD_SECRET;

    if (!resetSecret) {
      throw new AppError("ระบบยังไม่ได้ตั้งค่า JWT secret", 500);
    }

    try {
      const decoded = jwt.verify(token, resetSecret);

      if (decoded?.purpose !== "reset_password") {
        throw new AppError("Token สำหรับรีเซ็ตรหัสผ่านไม่ถูกต้อง", 400);
      }

      return decoded;
    } catch (_error) {
      console.error("Reset password token verification failed:", _error);
      throw new AppError("Token รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ", 400);
    }
  }

  async ensureResetPasswordTokenUsable(token) {
    const decoded = this.verifyResetPasswordToken(token);
    const user = await AuthModel.findUserById(decoded.user_id);

    if (!user || user.email !== decoded.email) {
      throw new AppError("Token รีเซ็ตรหัสผ่านไม่ถูกต้อง", 400);
    }

    const currentPasswordVersion = this.buildPasswordVersion(
      user.password_hash,
    );
    if (
      !decoded?.pwdv ||
      !currentPasswordVersion ||
      decoded.pwdv !== currentPasswordVersion
    ) {
      throw new AppError("ลิงก์รีเซ็ตรหัสผ่านถูกใช้งานไปแล้วหรือหมดอายุ", 400);
    }

    if (user.is_active !== 1) {
      throw new AppError("บัญชีของคุณถูกระงับการใช้งาน", 403);
    }

    return {
      user,
      decoded,
    };
  }

  buildResetPasswordUrl(resetToken) {
    const webBaseUrl = process.env.WEB_BASE_URL || "http://localhost:5173";

    return `${String(webBaseUrl).replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;
  }

  buildForgotPasswordEmailHtml({ resetUrl, userEmail }) {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="margin: 0 0 12px;">รีเซ็ตรหัสผ่าน Timesnow</h2>
        <p style="margin: 0 0 12px;">เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี ${userEmail}</p>
        <p style="margin: 0 0 16px;">คลิกปุ่มด้านล่างเพื่อกำหนดรหัสผ่านใหม่ (ลิงก์มีอายุจำกัด):</p>
        <p style="margin: 0 0 20px;">
          <a href="${resetUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 8px;">
            ตั้งรหัสผ่านใหม่
          </a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">หากปุ่มไม่ทำงาน ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:</p>
        <p style="margin: 0; font-size: 13px; word-break: break-all; color: #2563eb;">${resetUrl}</p>
      </div>
    `;
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

  async forgotPassword(email) {
    if (!email) {
      throw new AppError("กรุณาระบุอีเมล", 400);
    }

    const user = await AuthModel.findUserByEmail(email);

    if (!user) {
      // เพื่อความปลอดภัย: ตอบกลับสำเร็จเหมือนกันเสมอ
      return {
        message:
          "หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้คุณทางอีเมล",
      };
    }

    const resetToken = this.signResetPasswordToken(user);
    const resetUrl = this.buildResetPasswordUrl(resetToken);

    const subject = "รีเซ็ตรหัสผ่าน Timesnow";
    const html = this.buildForgotPasswordEmailHtml({
      resetUrl,
      userEmail: user.email,
    });

    await sendMailApi({
      to: user.email,
      subject,
      html,
    });

    return {
      message:
        "หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้คุณทางอีเมล",
    };
  }

  async resetPassword(token, newPassword) {
    if (!token) {
      throw new AppError("ไม่พบ Token สำหรับรีเซ็ตรหัสผ่าน", 400);
    }

    if (!newPassword || String(newPassword).length < 6) {
      throw new AppError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร", 400);
    }

    const { user } = await this.ensureResetPasswordTokenUsable(token);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await AuthModel.updatePasswordHash(user.id, passwordHash);
    await AuthModel.revokeAllRefreshTokensByUserId(user.id);

    return {
      message: "รหัสผ่านถูกเปลี่ยนเรียบร้อยแล้ว",
    };
  }

  async validateResetPasswordLink(token) {
    const { user, decoded } = await this.ensureResetPasswordTokenUsable(token);

    return {
      valid: true,
      user_id: user.id,
      email: user.email,
      expires_at: decoded?.exp
        ? new Date(decoded.exp * 1000).toISOString()
        : null,
    };
  }
}

module.exports = new AuthService();
