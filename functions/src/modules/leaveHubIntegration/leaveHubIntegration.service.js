const axios = require("axios");
const crypto = require("node:crypto");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");
const LeaveHubIntegrationModel = require("./leaveHubIntegration.model");

const {
  LEAVE_HUB_LOGIN_URL = "https://apiv2-tnlncwsaha-as.a.run.app/login",
  LEAVE_HUB_LEAVE_REQUEST_URL = "https://apiv2-tnlncwsaha-as.a.run.app/leave_request",
  LEAVE_HUB_LEAVE_TYPE_URL = "https://apiv2-tnlncwsaha-as.a.run.app/leaveType",
  LEAVE_HUB_SWAP_REQUEST_URL = "https://apiv2-tnlncwsaha-as.a.run.app/swap_request",
  LEAVE_HUB_STAFF_URL = "https://apiv2-tnlncwsaha-as.a.run.app/staff/staff",
  LEAVE_HUB_CUSTOM_DAYOFF_URL = "https://apiv2-tnlncwsaha-as.a.run.app/customDayoff/all",
  LEAVE_HUB_HOLIDAYS_URL = "https://apiv2-tnlncwsaha-as.a.run.app/holiday",
  LEAVE_HUB_CREDENTIAL_SECRET,
} = process.env;

class LeaveHubIntegrationService {
  getCredentialEncryptionKey() {
    if (!LEAVE_HUB_CREDENTIAL_SECRET) {
      throw new AppError(
        "ยังไม่ได้ตั้งค่า LEAVE_HUB_CREDENTIAL_SECRET สำหรับเข้ารหัสข้อมูล",
        500,
      );
    }

    return crypto
      .createHash("sha256")
      .update(LEAVE_HUB_CREDENTIAL_SECRET)
      .digest();
  }

  encryptCredential(plainText) {
    if (!plainText) {
      return null;
    }

    const key = this.getCredentialEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
      cipher.update(String(plainText), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
    return `enc:v1:${payload}`;
  }

  decryptCredential(cipherText) {
    if (!cipherText) {
      return null;
    }

    if (!String(cipherText).startsWith("enc:v1:")) {
      return cipherText;
    }

    const payload = Buffer.from(
      String(cipherText).replace("enc:v1:", ""),
      "base64",
    );
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);

    const key = this.getCredentialEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }

  maskSecret(value) {
    return value ? "***" : null;
  }

  formatDateTimeForDb(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  // ==============================================================
  // เรียก Login กับ LeaveHub เพื่อขอข้อมูล session ล่าสุด
  async loginToLeaveHub(username, password) {
    try {
      const response = await axios.post(
        LEAVE_HUB_LOGIN_URL,
        { username, password },
        { timeout: 15000 },
      );

      const payload = response.data?.data || response.data || {};
      const token =
        payload.token ||
        payload.accessToken ||
        payload.access_token ||
        payload.jwt;
      const leaveHubCompanyId = payload.companyId || payload.company_id;

      if (!token) {
        throw new AppError("LeaveHub ไม่ส่ง Token กลับมา", 502);
      }

      return {
        token,
        leaveHubCompanyId,
        raw: payload,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const statusCode = error.response?.status || 502;
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "username หรือ password ไม่ถูกต้อง";

      throw new AppError(message, statusCode);
    }
  }

  // ==============================================================
  // เชื่อมต่อ LeaveHub ครั้งแรกและบันทึก credential ลงฐานข้อมูล
  async connectLeaveHub(user, payload, ipAddress) {
    const { company_id: requestedCompanyId, username, password } = payload;

    if (!requestedCompanyId || !username || !password) {
      throw new AppError("กรุณาระบุ company_id, username และ password", 400);
    }

    if (Number(requestedCompanyId) !== Number(user.company_id)) {
      throw new AppError("ไม่สามารถเชื่อมต่อข้ามบริษัทได้", 403);
    }

    const company =
      await LeaveHubIntegrationModel.findCompanyLeaveHubCredentials(
        requestedCompanyId,
      );

    if (!company) {
      throw new AppError("ไม่พบบริษัทที่ต้องการเชื่อมต่อ", 404);
    }

    const loginResult = await this.loginToLeaveHub(username, password);
    const leaveHubCompanyId = Number(
      loginResult.leaveHubCompanyId || company.leave_hub_company_id,
    );

    if (!leaveHubCompanyId) {
      throw new AppError("LeaveHub ไม่ส่ง companyId ที่ใช้งานได้", 502);
    }

    const newIntegration = {
      leave_hub_company_id: leaveHubCompanyId,
      leave_hub_username: username,
      leave_hub_password: this.encryptCredential(password),
      last_sync_time: this.formatDateTimeForDb(new Date()),
    };

    await LeaveHubIntegrationModel.updateLeaveHubCredentials(
      requestedCompanyId,
      newIntegration,
    );

    await auditRecord({
      userId: user.id,
      companyId: requestedCompanyId,
      action: "UPDATE",
      table: "companies",
      recordId: requestedCompanyId,
      oldVal: {
        leave_hub_company_id: company.leave_hub_company_id,
        leave_hub_username: company.leave_hub_username,
        leave_hub_password: this.maskSecret(company.leave_hub_password),
      },
      newVal: {
        leave_hub_company_id: newIntegration.leave_hub_company_id,
        leave_hub_username: newIntegration.leave_hub_username,
        leave_hub_password: this.maskSecret(newIntegration.leave_hub_password),
        last_sync_time: newIntegration.last_sync_time,
      },
      ipAddress,
    });

    // ดึงข้อมูลทันทีหลัง login สำเร็จ
    const syncPayload = await this.fetchLeaveHubSyncData(
      loginResult.token,
      leaveHubCompanyId,
    );

    return {
      leave_hub_company_id: leaveHubCompanyId,
      connected_at: new Date().toISOString(),
      last_sync_time: newIntegration.last_sync_time,
      token: loginResult.token,
      synced_payload: syncPayload,
    };
  }

  // ==============================================================
  // ดึง token ใหม่จาก credential ที่เก็บไว้
  async getFreshToken(companyId) {
    const company =
      await LeaveHubIntegrationModel.findCompanyLeaveHubCredentials(companyId);

    if (!company) {
      throw new AppError("ไม่พบบริษัท", 404);
    }

    if (!company.leave_hub_username || !company.leave_hub_password) {
      throw new AppError("บริษัทยังไม่ได้เชื่อมต่อ LeaveHub", 400);
    }

    const decryptedPassword = this.decryptCredential(
      company.leave_hub_password,
    );

    const loginResult = await this.loginToLeaveHub(
      company.leave_hub_username,
      decryptedPassword,
    );

    return {
      token: loginResult.token,
      leave_hub_company_id:
        loginResult.leaveHubCompanyId || company.leave_hub_company_id,
    };
  }

  filterByCompany(items, companyId) {
    if (!Array.isArray(items)) {
      return items;
    }

    const targetCompanyId = Number(companyId);
    return items.filter((item) => Number(item?.companyId) === targetCompanyId);
  }

  // ==============================================================
  // ดึงข้อมูล LeaveHub ที่ใช้สำหรับซิงก์
  async fetchLeaveHubSyncData(token, leaveHubCompanyId) {
    if (
      !LEAVE_HUB_LEAVE_REQUEST_URL &&
      !LEAVE_HUB_LEAVE_TYPE_URL &&
      !LEAVE_HUB_SWAP_REQUEST_URL &&
      !LEAVE_HUB_STAFF_URL &&
      !LEAVE_HUB_CUSTOM_DAYOFF_URL &&
      !LEAVE_HUB_HOLIDAYS_URL
    ) {
      return null;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    const [
      leaveRequestsResponse,
      leaveTypesResponse,
      swapRequestsResponse,
      staffsResponse,
      customDayoffsResponse,
      holidaysResponse,
    ] = await Promise.all([
      LEAVE_HUB_LEAVE_REQUEST_URL
        ? axios.get(LEAVE_HUB_LEAVE_REQUEST_URL, { headers, timeout: 15000 })
        : Promise.resolve(null),
      LEAVE_HUB_LEAVE_TYPE_URL
        ? axios.get(LEAVE_HUB_LEAVE_TYPE_URL, { headers, timeout: 15000 })
        : Promise.resolve(null),
      LEAVE_HUB_SWAP_REQUEST_URL
        ? axios.get(LEAVE_HUB_SWAP_REQUEST_URL, { headers, timeout: 15000 })
        : Promise.resolve(null),
      LEAVE_HUB_STAFF_URL
        ? axios.get(LEAVE_HUB_STAFF_URL, { headers, timeout: 15000 })
        : Promise.resolve(null),
      LEAVE_HUB_CUSTOM_DAYOFF_URL
        ? axios.get(LEAVE_HUB_CUSTOM_DAYOFF_URL, { headers, timeout: 15000 })
        : Promise.resolve(null),
      LEAVE_HUB_HOLIDAYS_URL
        ? axios.get(LEAVE_HUB_HOLIDAYS_URL, { headers, timeout: 15000 })
        : Promise.resolve(null),
    ]);

    return {
      leave_requests: this.filterByCompany(
        leaveRequestsResponse?.data || null,
        leaveHubCompanyId,
      ),
      leave_types: this.filterByCompany(
        leaveTypesResponse?.data || null,
        leaveHubCompanyId,
      ),
      swap_requests: this.filterByCompany(
        swapRequestsResponse?.data || null,
        leaveHubCompanyId,
      ),
      staffs: this.filterByCompany(
        staffsResponse?.data || null,
        leaveHubCompanyId,
      ),
      custom_dayoffs: this.filterByCompany(
        customDayoffsResponse?.data || null,
        leaveHubCompanyId,
      ),
      holidays: this.filterByCompany(
        holidaysResponse?.data || null,
        leaveHubCompanyId,
      ),
    };
  }

  // ==============================================================
  // ซิงก์ข้อมูลล่าสุด (re-login อัตโนมัติและเตรียม token สำหรับเรียก API ถัดไป)
  async syncLeaveHubData(user, companyId, ipAddress) {
    if (Number(companyId) !== Number(user.company_id)) {
      throw new AppError("ไม่สามารถซิงก์ข้อมูลข้ามบริษัทได้", 403);
    }

    const company =
      await LeaveHubIntegrationModel.findCompanyLeaveHubCredentials(companyId);

    if (!company) {
      throw new AppError("ไม่พบบริษัท", 404);
    }

    const freshTokenResult = await this.getFreshToken(companyId);
    const syncPayload = await this.fetchLeaveHubSyncData(
      freshTokenResult.token,
      freshTokenResult.leave_hub_company_id,
    );
    const syncAt = this.formatDateTimeForDb(new Date());

    await LeaveHubIntegrationModel.updateLastSyncTime(companyId, syncAt);

    await auditRecord({
      userId: user.id,
      companyId,
      action: "UPDATE",
      table: "companies",
      recordId: companyId,
      oldVal: {
        last_sync_time: company.last_sync_time,
      },
      newVal: {
        leave_hub_company_id: freshTokenResult.leave_hub_company_id,
        sync_status: "success",
        last_sync_time: syncAt,
      },
      ipAddress,
    });

    return {
      synced_at: new Date().toISOString(),
      last_sync_time: syncAt,
      leave_hub_company_id: freshTokenResult.leave_hub_company_id,
      has_token: Boolean(freshTokenResult.token),
      token: freshTokenResult.token,
      synced_payload: syncPayload,
    };
  }

  // ==============================================================
  // ยกเลิกการเชื่อมต่อ LeaveHub
  async disconnectLeaveHub(user, companyId, ipAddress) {
    if (Number(companyId) !== Number(user.company_id)) {
      throw new AppError("ไม่สามารถยกเลิกการเชื่อมต่อข้ามบริษัทได้", 403);
    }

    const company =
      await LeaveHubIntegrationModel.findCompanyLeaveHubCredentials(companyId);

    if (!company) {
      throw new AppError("ไม่พบบริษัท", 404);
    }

    await LeaveHubIntegrationModel.clearLeaveHubCredentials(companyId);

    await auditRecord({
      userId: user.id,
      companyId,
      action: "UPDATE",
      table: "companies",
      recordId: companyId,
      oldVal: {
        leave_hub_company_id: company.leave_hub_company_id,
        leave_hub_username: company.leave_hub_username,
        leave_hub_password: this.maskSecret(company.leave_hub_password),
        last_sync_time: company.last_sync_time,
      },
      newVal: {
        leave_hub_company_id: null,
        leave_hub_username: null,
        leave_hub_password: null,
        last_sync_time: null,
      },
      ipAddress,
    });

    return {
      leave_hub_company_id: null,
      leave_hub_username: null,
      last_sync_time: null,
    };
  }
}

module.exports = new LeaveHubIntegrationService();
