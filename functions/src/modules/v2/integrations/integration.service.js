const axios = require("axios");
const crypto = require("node:crypto");
const AppError = require("../../../utils/AppError");
const db = require("../../../config/db.config");
const IntegrationModel = require("./integration.model");

const {
  LEAVE_HUB_LOGIN_URL = "https://apiv2-tnlncwsaha-as.a.run.app/login",
  LEAVE_HUB_LEAVE_REQUEST_URL = "https://apiv2-tnlncwsaha-as.a.run.app/leave_request",
  LEAVE_HUB_LEAVE_TYPE_URL = "https://apiv2-tnlncwsaha-as.a.run.app/leaveType",
  LEAVE_HUB_SWAP_REQUEST_URL = "https://apiv2-tnlncwsaha-as.a.run.app/swap_request",
  LEAVE_HUB_STAFF_URL = "https://apiv2-tnlncwsaha-as.a.run.app/staff/staff",
  LEAVE_HUB_CUSTOM_DAYOFF_URL = "https://apiv2-tnlncwsaha-as.a.run.app/customDayoff/all",
  LEAVE_HUB_HOLIDAYS_URL = "https://apiv2-tnlncwsaha-as.a.run.app/holiday",
} = process.env;

class IntegrationService {
  parseCredentialPayload(value) {
    if (!value) return null;
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value;
  }

  getCredentialSecret() {
    const secret =
      process.env.LEAVE_HUB_CREDENTIAL_SECRET || process.env.JWT_SECRET;

    if (!secret) {
      throw new AppError(
        "ระบบยังไม่ได้ตั้งค่า secret สำหรับเข้ารหัสข้อมูล",
        500,
      );
    }

    return secret;
  }

  encryptCredentialValue(plainValue) {
    const key = crypto
      .createHash("sha256")
      .update(this.getCredentialSecret())
      .digest();

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
      cipher.update(String(plainValue), "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();
    return `enc:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  decryptCredentialValue(encryptedValue) {
    if (!encryptedValue) return null;

    const raw = String(encryptedValue);
    if (!raw.startsWith("enc:")) {
      return raw;
    }

    const [, ivBase64, tagBase64, encryptedBase64] = raw.split(":");
    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
      throw new AppError("ข้อมูล credential ที่เข้ารหัสไม่ถูกต้อง", 500);
    }

    const key = crypto
      .createHash("sha256")
      .update(this.getCredentialSecret())
      .digest();

    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(tagBase64, "base64");
    const encrypted = Buffer.from(encryptedBase64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }

  getLeaveHubCredentialsFromIntegration(row) {
    const payload = this.parseCredentialPayload(row?.credential_payload);
    if (!payload) {
      throw new AppError("ไม่พบข้อมูล credential ของ Leavehub", 400);
    }

    const leavehubCompanyId = this.decryptCredentialValue(
      payload.leavehub_company_id,
    );
    const username = this.decryptCredentialValue(payload.username);
    const password = this.decryptCredentialValue(payload.password);

    if (!leavehubCompanyId || !username || !password) {
      throw new AppError("ข้อมูล credential ของ Leavehub ไม่ครบถ้วน", 400);
    }

    return {
      leavehubCompanyId: Number(leavehubCompanyId),
      username,
      password,
    };
  }

  extractLeaveHubToken(responseData) {
    const payload = responseData?.data || responseData || {};
    return {
      token:
        payload.token ||
        payload.accessToken ||
        payload.access_token ||
        payload.jwt ||
        null,
      leavehubCompanyId:
        payload.companyId || payload.company_id || payload.leavehub_company_id,
    };
  }

  async loginToLeaveHub(username, password) {
    try {
      const response = await axios.post(
        LEAVE_HUB_LOGIN_URL,
        { username, password },
        { timeout: 15000 },
      );

      const tokenInfo = this.extractLeaveHubToken(response.data);
      if (!tokenInfo.token) {
        throw new AppError("Leavehub ไม่ส่ง token กลับมา", 502);
      }

      return tokenInfo;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const statusCode = error?.response?.status || 502;
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "ไม่สามารถเชื่อมต่อ Leavehub ได้";

      throw new AppError(message, statusCode);
    }
  }

  filterByLeavehubCompany(items, leavehubCompanyId) {
    if (!Array.isArray(items)) return [];
    const targetCompanyId = Number(leavehubCompanyId);
    return items.filter((item) => Number(item?.companyId) === targetCompanyId);
  }

  async fetchLeaveHubSyncData(token, leavehubCompanyId) {
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
        : Promise.resolve({ data: [] }),
      LEAVE_HUB_LEAVE_TYPE_URL
        ? axios.get(LEAVE_HUB_LEAVE_TYPE_URL, { headers, timeout: 15000 })
        : Promise.resolve({ data: [] }),
      LEAVE_HUB_SWAP_REQUEST_URL
        ? axios.get(LEAVE_HUB_SWAP_REQUEST_URL, { headers, timeout: 15000 })
        : Promise.resolve({ data: [] }),
      LEAVE_HUB_STAFF_URL
        ? axios.get(LEAVE_HUB_STAFF_URL, { headers, timeout: 15000 })
        : Promise.resolve({ data: [] }),
      LEAVE_HUB_CUSTOM_DAYOFF_URL
        ? axios.get(LEAVE_HUB_CUSTOM_DAYOFF_URL, { headers, timeout: 15000 })
        : Promise.resolve({ data: [] }),
      LEAVE_HUB_HOLIDAYS_URL
        ? axios.get(LEAVE_HUB_HOLIDAYS_URL, { headers, timeout: 15000 })
        : Promise.resolve({ data: [] }),
    ]);

    return {
      leave_requests: this.filterByLeavehubCompany(
        leaveRequestsResponse?.data,
        leavehubCompanyId,
      ),
      leave_types: this.filterByLeavehubCompany(
        leaveTypesResponse?.data,
        leavehubCompanyId,
      ),
      swap_requests: this.filterByLeavehubCompany(
        swapRequestsResponse?.data,
        leavehubCompanyId,
      ),
      staffs: this.filterByLeavehubCompany(
        staffsResponse?.data,
        leavehubCompanyId,
      ),
      custom_dayoffs: this.filterByLeavehubCompany(
        customDayoffsResponse?.data,
        leavehubCompanyId,
      ),
      holidays: this.filterByLeavehubCompany(
        holidaysResponse?.data,
        leavehubCompanyId,
      ),
    };
  }

  summarizeSyncPayload(payload) {
    return {
      leave_requests: payload.leave_requests.length,
      leave_types: payload.leave_types.length,
      swap_requests: payload.swap_requests.length,
      staffs: payload.staffs.length,
      custom_dayoffs: payload.custom_dayoffs.length,
      holidays: payload.holidays.length,
    };
  }

  normalizePassportValue(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized || null;
  }

  toDateString(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  expandDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate || startDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return [];
    }

    const dates = [];

    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    ) {
      dates.push(cursor.toISOString().slice(0, 10));
    }

    return dates;
  }

  isApprovedStatus(status) {
    if (!status) return true;
    const approvedStatuses = ["approved", "approve", "อนุมัติ", "confirmed"];
    return approvedStatuses.includes(String(status).toLowerCase());
  }

  getLeaveHubPassportFromRecord(record, staffPassportById = new Map()) {
    const directValue =
      record?.ID_or_Passport_Number ||
      record?.id_or_passport_number ||
      record?.idOrPassportNumber ||
      record?.passport_number ||
      record?.passportNumber ||
      record?.staff?.ID_or_Passport_Number ||
      record?.staff?.id_or_passport_number;

    const normalizedDirect = this.normalizePassportValue(directValue);
    if (normalizedDirect) {
      return normalizedDirect;
    }

    const possibleStaffId =
      record?.staff_id ||
      record?.staffId ||
      record?.employee_id ||
      record?.employeeId ||
      record?.user_id ||
      record?.userId;

    if (possibleStaffId === null || possibleStaffId === undefined) {
      return null;
    }

    return (
      staffPassportById.get(String(possibleStaffId)) ||
      staffPassportById.get(Number(possibleStaffId)) ||
      null
    );
  }

  getDateCandidateFromRecord(record, keys) {
    for (const key of keys) {
      const value = this.toDateString(record?.[key]);
      if (value) return value;
    }
    return null;
  }

  resolveLeaveTypeMap(leaveTypes) {
    const map = new Map();

    (Array.isArray(leaveTypes) ? leaveTypes : []).forEach((item) => {
      if (item?.id === null || item?.id === undefined) return;
      map.set(String(item.id), String(item?.name || "").toLowerCase());
    });

    return map;
  }

  mapLeaveTypeToDayType(leaveRequest, leaveTypeMap) {
    const leaveTypeName =
      leaveTypeMap.get(String(leaveRequest?.leave_type_id)) ||
      String(leaveRequest?.leave_type_name || "").toLowerCase();

    if (!leaveTypeName) return "other_leave";
    if (leaveTypeName.includes("ป่วย") || leaveTypeName.includes("sick")) {
      return "sick_leave";
    }
    if (
      leaveTypeName.includes("พักร้อน") ||
      leaveTypeName.includes("annual") ||
      leaveTypeName.includes("vacation")
    ) {
      return "annual_leave";
    }
    if (leaveTypeName.includes("กิจ") || leaveTypeName.includes("private")) {
      return "private_leave";
    }
    if (leaveTypeName.includes("ไม่รับ") || leaveTypeName.includes("unpaid")) {
      return "unpaid_leave";
    }
    return "other_leave";
  }

  mapHolidayToDayType(holidayRecord) {
    const holidayName = String(
      holidayRecord?.holiday_name || holidayRecord?.name || "",
    ).toLowerCase();

    if (
      holidayName.includes("ชดเชย") ||
      holidayName.includes("compens") ||
      holidayRecord?.is_compensation === true ||
      holidayRecord?.is_compensation === 1
    ) {
      return "compensated_holiday";
    }

    return "public_holiday";
  }

  setEventWithPriority(eventsMap, event) {
    const key = `${event.employee_id}|${event.work_date}`;
    const current = eventsMap.get(key);

    if (!current || event.priority < current.priority) {
      eventsMap.set(key, event);
    }
  }

  buildStaffPassportMap(staffs) {
    const map = new Map();

    (Array.isArray(staffs) ? staffs : []).forEach((staff) => {
      const staffId =
        staff?.id ||
        staff?.staff_id ||
        staff?.staffId ||
        staff?.employee_id ||
        staff?.employeeId ||
        staff?.user_id;

      const passport = this.normalizePassportValue(
        staff?.ID_or_Passport_Number ||
          staff?.id_or_passport_number ||
          staff?.idOrPassportNumber,
      );

      if (staffId !== null && staffId !== undefined && passport) {
        map.set(String(staffId), passport);
      }
    });

    return map;
  }

  buildPayloadHash(event) {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          employee_id: event.employee_id,
          work_date: event.work_date,
          day_type: event.day_type,
          leave_hours_data: event.leave_hours_data || null,
        }),
      )
      .digest("hex");
  }

  async reconcileSyncPayloadToRosters(companyId, syncPayload, executor) {
    const employees = await IntegrationModel.findEmployeesForLeaveHubMapping(
      companyId,
      executor,
    );

    const employeeByPassport = new Map();
    const allEmployeeIds = [];

    employees.forEach((employee) => {
      allEmployeeIds.push(Number(employee.id));
      const passport = this.normalizePassportValue(
        employee.id_or_passport_number,
      );
      if (passport) {
        employeeByPassport.set(passport, Number(employee.id));
      }
    });

    const staffPassportById = this.buildStaffPassportMap(syncPayload.staffs);
    const leaveTypeMap = this.resolveLeaveTypeMap(syncPayload.leave_types);
    const eventsMap = new Map();
    let unmatchedRecords = 0;

    (Array.isArray(syncPayload.leave_requests)
      ? syncPayload.leave_requests
      : []
    ).forEach((leaveRequest) => {
      if (!this.isApprovedStatus(leaveRequest?.status)) return;

      const passport = this.getLeaveHubPassportFromRecord(
        leaveRequest,
        staffPassportById,
      );

      if (!passport || !employeeByPassport.has(passport)) {
        unmatchedRecords += 1;
        return;
      }

      const employeeId = employeeByPassport.get(passport);
      const startDate = this.getDateCandidateFromRecord(leaveRequest, [
        "start_date",
        "date",
        "work_date",
      ]);
      const endDate = this.getDateCandidateFromRecord(leaveRequest, [
        "end_date",
      ]);

      if (!startDate) {
        unmatchedRecords += 1;
        return;
      }

      const dayType = this.mapLeaveTypeToDayType(leaveRequest, leaveTypeMap);
      const leaveHoursData =
        leaveRequest?.start_time && leaveRequest?.end_time
          ? [
              {
                start: leaveRequest.start_time,
                end: leaveRequest.end_time,
                type: dayType,
              },
            ]
          : null;

      this.expandDateRange(startDate, endDate || startDate).forEach(
        (dateString) => {
          this.setEventWithPriority(eventsMap, {
            employee_id: employeeId,
            work_date: dateString,
            day_type: dayType,
            leave_hours_data: leaveHoursData,
            priority: 1,
          });
        },
      );
    });

    (Array.isArray(syncPayload.swap_requests)
      ? syncPayload.swap_requests
      : []
    ).forEach((swapRequest) => {
      if (!this.isApprovedStatus(swapRequest?.status)) return;

      const passport = this.getLeaveHubPassportFromRecord(
        swapRequest,
        staffPassportById,
      );

      if (!passport || !employeeByPassport.has(passport)) {
        unmatchedRecords += 1;
        return;
      }

      const employeeId = employeeByPassport.get(passport);
      const workDate = this.getDateCandidateFromRecord(swapRequest, [
        "new_date",
        "date",
        "work_date",
      ]);

      if (!workDate) {
        unmatchedRecords += 1;
        return;
      }

      this.setEventWithPriority(eventsMap, {
        employee_id: employeeId,
        work_date: workDate,
        day_type: "holiday_swap",
        leave_hours_data: null,
        priority: 2,
      });
    });

    (Array.isArray(syncPayload.custom_dayoffs)
      ? syncPayload.custom_dayoffs
      : []
    ).forEach((customDayoff) => {
      const passport = this.getLeaveHubPassportFromRecord(
        customDayoff,
        staffPassportById,
      );

      if (!passport || !employeeByPassport.has(passport)) {
        unmatchedRecords += 1;
        return;
      }

      const employeeId = employeeByPassport.get(passport);

      const customDates = Array.isArray(customDayoff?.off_dates)
        ? customDayoff.off_dates
        : [customDayoff?.off_date, customDayoff?.date, customDayoff?.work_date];

      customDates.forEach((dateValue) => {
        const workDate = this.toDateString(dateValue);
        if (!workDate) return;

        this.setEventWithPriority(eventsMap, {
          employee_id: employeeId,
          work_date: workDate,
          day_type: "weekly_off",
          leave_hours_data: null,
          priority: 4,
        });
      });
    });

    (Array.isArray(syncPayload.holidays) ? syncPayload.holidays : []).forEach(
      (holiday) => {
        const holidayDate = this.getDateCandidateFromRecord(holiday, [
          "holiday_date",
          "date",
          "work_date",
          "off_date",
        ]);

        if (!holidayDate) return;

        const dayType = this.mapHolidayToDayType(holiday);

        allEmployeeIds.forEach((employeeId) => {
          this.setEventWithPriority(eventsMap, {
            employee_id: employeeId,
            work_date: holidayDate,
            day_type: dayType,
            leave_hours_data: null,
            priority: 2,
          });
        });
      },
    );

    const events = Array.from(eventsMap.values());
    if (!events.length) {
      return {
        reconciled_rosters: 0,
        affected_summaries: 0,
        matched_employees: employeeByPassport.size,
        unmatched_records: unmatchedRecords,
      };
    }

    const affectedEmployeeIds = new Set();
    let minDate = events[0].work_date;
    let maxDate = events[0].work_date;

    for (const event of events) {
      affectedEmployeeIds.add(event.employee_id);

      if (event.work_date < minDate) {
        minDate = event.work_date;
      }
      if (event.work_date > maxDate) {
        maxDate = event.work_date;
      }

      await IntegrationModel.upsertLeaveHubRoster(
        {
          company_id: companyId,
          employee_id: event.employee_id,
          work_date: event.work_date,
          day_type: event.day_type,
          leave_hours_data: event.leave_hours_data,
          source_payload_hash: this.buildPayloadHash(event),
        },
        executor,
      );
    }

    const affectedSummaries =
      await IntegrationModel.recalculateAttendanceSummariesByEmployeeDateRange(
        companyId,
        Array.from(affectedEmployeeIds),
        minDate,
        maxDate,
        executor,
      );

    return {
      reconciled_rosters: events.length,
      affected_summaries: affectedSummaries,
      matched_employees: employeeByPassport.size,
      unmatched_records: unmatchedRecords,
    };
  }

  toSafeSyncErrorMessage(error) {
    const rawMessage =
      error?.message ||
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      "ไม่สามารถซิงก์ข้อมูล Leavehub ได้";

    return String(rawMessage).slice(0, 1000);
  }

  async markSyncFailed(companyId, integrationId, errorMessage) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      await IntegrationModel.updateSyncState(
        integrationId,
        {
          sync_status: "failed",
          sync_error_message: errorMessage,
          last_sync_at: null,
        },
        connection,
      );

      await connection.commit();
    } catch (updateError) {
      await connection.rollback();
      console.error("Failed to update Leavehub sync status:", updateError);
    } finally {
      connection.release();
    }
  }

  sanitizeIntegrationRow(row) {
    const payload = this.parseCredentialPayload(row.credential_payload);

    return {
      id: row.id,
      company_id: row.company_id,
      integration_type: row.integration_type,
      status: {
        key: row.status,
        label: row.status === "active" ? "เชื่อมต่อแล้ว" : "ปิดการเชื่อมต่อ",
      },
      activated_at: row.activated_at,
      deactivated_at: row.deactivated_at,
      last_sync_at: row.last_sync_at,
      sync_status: row.sync_status,
      sync_error_message: row.sync_error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
      has_credentials: Boolean(payload),
    };
  }

  buildEncryptedCredentialPayload(data) {
    return {
      leavehub_company_id: this.encryptCredentialValue(
        data.leavehub_company_id,
      ),
      username: this.encryptCredentialValue(data.username),
      password: this.encryptCredentialValue(data.password),
    };
  }

  validateConnectPayload(payload) {
    const requiredFields = ["username", "password"];

    requiredFields.forEach((field) => {
      if (!payload?.[field]) {
        throw new AppError(`กรุณาระบุ ${field}`, 400);
      }
    });
  }

  async getLeaveHubStatus(companyId) {
    const row = await IntegrationModel.findLeaveHubIntegration(companyId);

    if (!row) {
      return {
        connected: false,
        integration: null,
      };
    }

    return {
      connected: row.status === "active",
      integration: this.sanitizeIntegrationRow(row),
    };
  }

  async connectLeaveHub(user, payload, ipAddress) {
    this.validateConnectPayload(payload);

    const { username, password } = payload;
    const loginResult = await this.loginToLeaveHub(username, password);
    const leavehubCompanyId = Number(loginResult.leavehubCompanyId);

    if (!leavehubCompanyId) {
      throw new AppError(
        "Leavehub ไม่ส่ง leavehub_company_id ที่ใช้งานได้",
        502,
      );
    }

    const encryptedCredentialPayload = this.buildEncryptedCredentialPayload({
      leavehub_company_id: leavehubCompanyId,
      username,
      password,
    });

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const existing = await IntegrationModel.findLeaveHubIntegration(
        user.company_id,
        connection,
      );

      if (!existing) {
        const newId = await IntegrationModel.createLeaveHubIntegration(
          {
            company_id: user.company_id,
            credential_payload: encryptedCredentialPayload,
          },
          connection,
        );

        const inserted = await IntegrationModel.findLeaveHubIntegration(
          user.company_id,
          connection,
        );

        await IntegrationModel.insertAuditTrail(
          {
            company_id: user.company_id,
            user_id: user.id,
            action_type: "INSERT",
            table_name: "company_integrations",
            record_id: newId,
            old_values: null,
            new_values: {
              integration_type: "leavehub",
              status: "active",
              has_credentials: true,
            },
            ip_address: ipAddress,
          },
          connection,
        );

        await connection.commit();

        const syncResult = await this.syncLeaveHub(user, ipAddress, {
          token: loginResult.token,
          leavehubCompanyId,
        });

        return {
          connected: true,
          integration:
            syncResult.integration || this.sanitizeIntegrationRow(inserted),
          initial_sync: {
            synced: syncResult.synced,
            synced_at: syncResult.synced_at,
            summary: syncResult.summary,
          },
        };
      }

      await IntegrationModel.updateLeaveHubIntegration(
        existing.id,
        {
          credential_payload: encryptedCredentialPayload,
        },
        connection,
      );

      const updated = await IntegrationModel.findLeaveHubIntegration(
        user.company_id,
        connection,
      );

      await IntegrationModel.insertAuditTrail(
        {
          company_id: user.company_id,
          user_id: user.id,
          action_type: "UPDATE",
          table_name: "company_integrations",
          record_id: existing.id,
          old_values: {
            integration_type: existing.integration_type,
            status: existing.status,
            has_credentials: Boolean(
              this.parseCredentialPayload(existing.credential_payload),
            ),
          },
          new_values: {
            integration_type: "leavehub",
            status: "active",
            has_credentials: true,
          },
          ip_address: ipAddress,
        },
        connection,
      );

      await connection.commit();

      const syncResult = await this.syncLeaveHub(user, ipAddress, {
        token: loginResult.token,
        leavehubCompanyId,
      });

      return {
        connected: true,
        integration:
          syncResult.integration || this.sanitizeIntegrationRow(updated),
        initial_sync: {
          synced: syncResult.synced,
          synced_at: syncResult.synced_at,
          summary: syncResult.summary,
        },
      };
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback failed in connectLeaveHub:", rollbackError);
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async disconnectLeaveHub(user, ipAddress) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const existing = await IntegrationModel.findLeaveHubIntegration(
        user.company_id,
        connection,
      );

      if (!existing) {
        await connection.commit();
        return {
          disconnected: true,
          already_disconnected: true,
          roster_recalculation: {
            from_date: new Date().toISOString().slice(0, 10),
            affected_rosters: 0,
            affected_summaries: 0,
          },
        };
      }

      const today = new Date().toISOString().slice(0, 10);
      const targetRosterIds =
        await IntegrationModel.findFutureLeaveHubRosterIds(
          user.company_id,
          today,
          connection,
        );

      const affectedRosters =
        await IntegrationModel.recalculateFutureLeaveHubRostersToLocal(
          user.company_id,
          today,
          connection,
        );

      const affectedSummaries =
        await IntegrationModel.recalculateAttendanceSummariesByRosterIds(
          targetRosterIds,
          connection,
        );

      await IntegrationModel.deactivateLeaveHubIntegration(
        existing.id,
        connection,
      );

      const updated = await IntegrationModel.findLeaveHubIntegration(
        user.company_id,
        connection,
      );

      await IntegrationModel.insertAuditTrail(
        {
          company_id: user.company_id,
          user_id: user.id,
          action_type: "UPDATE",
          table_name: "company_integrations",
          record_id: existing.id,
          old_values: {
            integration_type: existing.integration_type,
            status: existing.status,
            has_credentials: Boolean(
              this.parseCredentialPayload(existing.credential_payload),
            ),
          },
          new_values: {
            integration_type: updated?.integration_type || "leavehub",
            status: updated?.status || "inactive",
            has_credentials: Boolean(
              this.parseCredentialPayload(updated?.credential_payload),
            ),
            deactivated_at: updated?.deactivated_at || null,
            roster_recalculation: {
              from_date: today,
              affected_rosters: affectedRosters,
              affected_summaries: affectedSummaries,
            },
          },
          ip_address: ipAddress,
        },
        connection,
      );

      await connection.commit();

      return {
        disconnected: true,
        already_disconnected: false,
        roster_recalculation: {
          from_date: today,
          affected_rosters: affectedRosters,
          affected_summaries: affectedSummaries,
        },
        integration: updated ? this.sanitizeIntegrationRow(updated) : null,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async syncLeaveHub(user, ipAddress, preAuth = null) {
    try {
      const existing = await IntegrationModel.findLeaveHubIntegration(
        user.company_id,
      );

      if (existing?.status !== "active") {
        throw new AppError("กรุณาเชื่อมต่อ Leavehub ก่อนทำการซิงก์", 400);
      }

      let token;
      let resolvedLeavehubCompanyId;

      if (preAuth?.token) {
        token = preAuth.token;
        resolvedLeavehubCompanyId = Number(preAuth.leavehubCompanyId);

        if (!resolvedLeavehubCompanyId) {
          const credentials =
            this.getLeaveHubCredentialsFromIntegration(existing);
          resolvedLeavehubCompanyId = credentials.leavehubCompanyId;
        }
      } else {
        const credentials =
          this.getLeaveHubCredentialsFromIntegration(existing);
        const loginResult = await this.loginToLeaveHub(
          credentials.username,
          credentials.password,
        );

        token = loginResult.token;
        resolvedLeavehubCompanyId =
          Number(loginResult.leavehubCompanyId) ||
          credentials.leavehubCompanyId;
      }

      const syncPayload = await this.fetchLeaveHubSyncData(
        token,
        resolvedLeavehubCompanyId,
      );

      const syncSummary = this.summarizeSyncPayload(syncPayload);

      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const latestState = await IntegrationModel.findLeaveHubIntegration(
          user.company_id,
          connection,
        );

        if (latestState?.status !== "active") {
          throw new AppError("สถานะการเชื่อมต่อ Leavehub ไม่พร้อมซิงก์", 400);
        }

        const oldValues = {
          sync_status: latestState.sync_status,
          last_sync_at: latestState.last_sync_at,
          sync_error_message: latestState.sync_error_message,
        };

        const reconcileResult = await this.reconcileSyncPayloadToRosters(
          user.company_id,
          syncPayload,
          connection,
        );

        const syncedAt = new Date();

        await IntegrationModel.updateSyncState(
          latestState.id,
          {
            sync_status: "success",
            sync_error_message: null,
            last_sync_at: syncedAt,
          },
          connection,
        );

        const updated = await IntegrationModel.findLeaveHubIntegration(
          user.company_id,
          connection,
        );

        await IntegrationModel.insertAuditTrail(
          {
            company_id: user.company_id,
            user_id: user.id,
            action_type: "UPDATE",
            table_name: "company_integrations",
            record_id: latestState.id,
            old_values: oldValues,
            new_values: {
              sync_status: updated.sync_status,
              last_sync_at: updated.last_sync_at,
              sync_error_message: updated.sync_error_message,
              summary: syncSummary,
              reconcile: reconcileResult,
            },
            ip_address: ipAddress,
          },
          connection,
        );

        await connection.commit();

        return {
          synced: true,
          synced_at: updated.last_sync_at,
          summary: syncSummary,
          reconcile: reconcileResult,
          integration: this.sanitizeIntegrationRow(updated),
        };
      } catch (transactionError) {
        await connection.rollback();
        throw transactionError;
      } finally {
        connection.release();
      }
    } catch (error) {
      const current = await IntegrationModel.findLeaveHubIntegration(
        user.company_id,
      );

      if (current?.status === "active") {
        await this.markSyncFailed(
          user.company_id,
          current.id,
          this.toSafeSyncErrorMessage(error),
        );
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(this.toSafeSyncErrorMessage(error), 503);
    }
  }
}

module.exports = new IntegrationService();
