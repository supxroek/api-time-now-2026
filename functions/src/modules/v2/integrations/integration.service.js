const axios = require("axios");
const crypto = require("node:crypto");
const AppError = require("../../../utils/AppError");
const db = require("../../../config/db.config");
const IntegrationModel = require("./integration.model");
const DayResolutionService = require("../day_resolution/day_resolution.service");

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
  static BULK_ROSTER_UPSERT_EMPLOYEE_THRESHOLD = 500;
  static COMPENSATION_SEARCH_LIMIT_DAYS = 30;

  static THAI_MONTH_MAP = {
    มกราคม: 1,
    กุมภาพันธ์: 2,
    มีนาคม: 3,
    เมษายน: 4,
    พฤษภาคม: 5,
    มิถุนายน: 6,
    กรกฎาคม: 7,
    สิงหาคม: 8,
    กันยายน: 9,
    ตุลาคม: 10,
    พฤศจิกายน: 11,
    ธันวาคม: 12,
    "ม.ค.": 1,
    "ก.พ.": 2,
    "มี.ค.": 3,
    "เม.ย.": 4,
    "พ.ค.": 5,
    "มิ.ย.": 6,
    "ก.ค.": 7,
    "ส.ค.": 8,
    "ก.ย.": 9,
    "ต.ค.": 10,
    "พ.ย.": 11,
    "ธ.ค.": 12,
  };

  static DEFAULT_THAI_LUNAR_MAP = {
    "ขึ้น 15 ค่ำ เดือน 3": {
      2024: "2024-02-24",
      2025: "2025-02-12",
      2026: "2026-03-03",
      2027: "2027-02-21",
      2028: "2028-02-10",
    },
    "ขึ้น 15 ค่ำ เดือน 6": {
      2024: "2024-05-22",
      2025: "2025-05-11",
      2026: "2026-05-31",
      2027: "2027-05-20",
      2028: "2028-05-08",
    },
    "ขึ้น 15 ค่ำ เดือน 8": {
      2024: "2024-07-20",
      2025: "2025-07-10",
      2026: "2026-07-29",
      2027: "2027-07-18",
      2028: "2028-07-06",
    },
  };

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
    const normalizedItems = this.extractArrayPayload(items);
    if (!Array.isArray(normalizedItems)) return [];

    const targetCompanyId = Number(leavehubCompanyId);
    if (!Number.isFinite(targetCompanyId) || targetCompanyId <= 0) {
      return normalizedItems;
    }

    return normalizedItems.filter((item) => {
      const companyId = Number(
        item?.companyId ??
          item?.company_id ??
          item?.leavehub_company_id ??
          item?.company?.id,
      );

      if (!Number.isFinite(companyId) || companyId <= 0) {
        return true;
      }

      return companyId === targetCompanyId;
    });
  }

  extractArrayPayload(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    if (Array.isArray(payload?.data?.data)) {
      return payload.data.data;
    }

    if (Array.isArray(payload?.items)) {
      return payload.items;
    }

    return [];
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
      leave_requests: Array.isArray(payload.leave_requests)
        ? payload.leave_requests.length
        : 0,
      leave_types: Array.isArray(payload.leave_types)
        ? payload.leave_types.length
        : 0,
      swap_requests: Array.isArray(payload.swap_requests)
        ? payload.swap_requests.length
        : 0,
      staffs: Array.isArray(payload.staffs) ? payload.staffs.length : 0,
      custom_dayoffs: Array.isArray(payload.custom_dayoffs)
        ? payload.custom_dayoffs.length
        : 0,
      holidays: Array.isArray(payload.holidays) ? payload.holidays.length : 0,
    };
  }

  buildSyncDebugInput(payload) {
    const hasEnvOverride = Boolean(process.env.LEAVE_HUB_THAI_LUNAR_MAP_JSON);

    return {
      counts: this.summarizeSyncPayload(payload),
      lunar_mapping: {
        env_override_enabled: hasEnvOverride,
        default_example: IntegrationService.DEFAULT_THAI_LUNAR_MAP,
      },
      received_payload: {
        leave_requests: Array.isArray(payload.leave_requests)
          ? payload.leave_requests.slice(0, 50)
          : [],
        leave_types: Array.isArray(payload.leave_types)
          ? payload.leave_types.slice(0, 50)
          : [],
        swap_requests: Array.isArray(payload.swap_requests)
          ? payload.swap_requests.slice(0, 50)
          : [],
        staffs: Array.isArray(payload.staffs)
          ? payload.staffs.slice(0, 50)
          : [],
        custom_dayoffs: Array.isArray(payload.custom_dayoffs)
          ? payload.custom_dayoffs.slice(0, 50)
          : [],
        holidays: Array.isArray(payload.holidays) ? payload.holidays : [],
      },
    };
  }

  convertLunarDateToGregorian(lunarDate, yearInput) {
    const normalized = String(lunarDate || "").trim();
    if (!normalized) return null;

    const dateLike = this.toDateString(normalized);
    if (dateLike) {
      return dateLike;
    }

    const slashPattern = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;
    const slashMatch = slashPattern.exec(normalized);
    if (slashMatch) {
      const day = Number(slashMatch[1]);
      const month = Number(slashMatch[2]);
      const year = Number(
        slashMatch[3] || yearInput || new Date().getFullYear(),
      );
      return this.toDateString(
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      );
    }

    const mappedDate = this.resolveThaiLunarDateByMapping(
      normalized,
      yearInput,
    );
    if (mappedDate) {
      return mappedDate;
    }

    return null;
  }

  resolveThaiLunarDateByMapping(lunarDate, yearInput) {
    const normalizedKey = String(lunarDate || "")
      .replaceAll(/\s+/g, " ")
      .trim();

    if (!normalizedKey) {
      return null;
    }

    let parsedMap = {};
    if (process.env.LEAVE_HUB_THAI_LUNAR_MAP_JSON) {
      try {
        parsedMap = JSON.parse(process.env.LEAVE_HUB_THAI_LUNAR_MAP_JSON);
      } catch (error) {
        console.warn("Invalid LEAVE_HUB_THAI_LUNAR_MAP_JSON format", error);
      }
    }

    const mergedMap = {
      ...IntegrationService.DEFAULT_THAI_LUNAR_MAP,
      ...parsedMap,
    };

    const mappingValue = mergedMap[normalizedKey];
    if (!mappingValue) {
      return null;
    }

    if (typeof mappingValue === "string") {
      return this.toDateString(mappingValue);
    }

    if (mappingValue && typeof mappingValue === "object") {
      const yearKey = String(
        Number(yearInput) || Number(new Date().getFullYear()),
      );
      return this.toDateString(mappingValue[yearKey]);
    }

    return null;
  }

  resolveHolidayWorkDates(holiday) {
    const baseYear =
      Number(holiday?.year) ||
      Number(holiday?.holiday_year) ||
      new Date().getFullYear();

    const explicitDate = this.getDateCandidateFromRecord(
      holiday,
      ["holiday_date", "date", "work_date", "off_date", "start_date"],
      { defaultYear: baseYear },
    );

    const endDate = this.getDateCandidateFromRecord(holiday, ["end_date"], {
      defaultYear: baseYear,
    });

    if (explicitDate) {
      return this.expandDateRange(explicitDate, endDate || explicitDate);
    }

    const lunarDate =
      holiday?.lunar_date || holiday?.lunarDate || holiday?.holiday_lunar_date;

    if (!lunarDate) {
      return [];
    }

    const convertedDate = this.convertLunarDateToGregorian(lunarDate, baseYear);
    if (!convertedDate) {
      console.warn("Skip holiday due to unresolved lunar date", {
        holiday_id: holiday?.id || null,
        holiday_name: holiday?.holiday_name || holiday?.name || null,
        lunar_date: lunarDate,
        base_year: baseYear,
      });
      return [];
    }

    return [convertedDate];
  }

  normalizePassportValue(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized || null;
  }

  toDateString(value, options = {}) {
    if (!value) return null;

    const normalizedRaw = String(value).trim();
    if (!normalizedRaw) return null;

    const thaiDate = this.parseThaiTextDate(normalizedRaw, options);
    if (thaiDate) {
      return thaiDate;
    }

    const parsed = new Date(normalizedRaw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  parseThaiTextDate(value, options = {}) {
    const normalized = String(value || "")
      .replaceAll(/\s+/g, " ")
      .trim();

    const thaiDatePattern = /^(\d{1,2})\s+([ก-๙.]+)(?:\s+(\d{4}))?$/;
    const match = thaiDatePattern.exec(normalized);
    if (!match) {
      return null;
    }

    const day = Number(match[1]);
    const monthToken = String(match[2]).trim();
    const month = IntegrationService.THAI_MONTH_MAP[monthToken];
    if (!month || !day) {
      return null;
    }

    let year = Number(
      match[3] || options.defaultYear || new Date().getFullYear(),
    );
    if (year >= 2400) {
      year -= 543;
    }

    return this.toDateString(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
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

  getDateCandidateFromRecord(record, keys, options = {}) {
    for (const key of keys) {
      const rawValue = record?.[key];
      const value = this.toDateString(rawValue, options);

      if (!value && rawValue) {
        const thaiDate = this.parseThaiTextDate(rawValue, options);
        if (thaiDate) {
          return thaiDate;
        }
      }

      if (value) return value;
    }
    return null;
  }

  pushDebugSample(targetArray, payload, limit = 200) {
    if (!Array.isArray(targetArray)) return;
    if (targetArray.length >= limit) return;
    targetArray.push(payload);
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
    const holidayType = String(
      holidayRecord?.holiday_type || holidayRecord?.type || "",
    ).toLowerCase();

    if (
      holidayName.includes("ชดเชย") ||
      holidayName.includes("compens") ||
      holidayType.includes("ชดเชย") ||
      holidayType.includes("compens") ||
      holidayType.includes("substitute") ||
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

  getWeekdayKey(workDate) {
    const weekdayKeys = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const [year, month, day] = String(workDate).split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekdayKeys[weekday];
  }

  addDays(workDate, daysToAdd) {
    const date = new Date(`${workDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + Number(daysToAdd));
    return date.toISOString().slice(0, 10);
  }

  parseLeavehubDayOffRule(dayOffRaw) {
    if (!dayOffRaw) {
      return { weekdays: [], customDates: [] };
    }

    let parsed = dayOffRaw;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = String(dayOffRaw)
          .split(/[,|;]/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    const source = Array.isArray(parsed) ? parsed : [parsed];
    const weekdays = [];
    const customDates = [];

    source.forEach((item) => {
      const token = String(item || "").trim();
      if (!token) return;

      const dateValue = this.toDateString(token);
      if (dateValue) {
        customDates.push(dateValue);
        return;
      }

      const upper = token.toUpperCase();
      const short = upper.slice(0, 3);
      if (["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].includes(short)) {
        weekdays.push(short);
      }
    });

    return { weekdays, customDates };
  }

  buildEmployeeLeaveHubDayoffRules(
    staffs,
    customDayoffs,
    employeeByPassport,
    staffPassportById,
  ) {
    const rulesMap = new Map();

    (Array.isArray(staffs) ? staffs : []).forEach((staff) => {
      const passport = this.normalizePassportValue(
        staff?.ID_or_Passport_Number ||
          staff?.id_or_passport_number ||
          staff?.idOrPassportNumber,
      );
      if (!passport || !employeeByPassport.has(passport)) {
        return;
      }

      const employeeId = employeeByPassport.get(passport);
      const dayOffStatus = Number(
        staff?.dayOff_Status ?? staff?.dayoff_status ?? 0,
      );
      const parsedRule = this.parseLeavehubDayOffRule(
        staff?.dayOff ?? staff?.dayoff,
      );

      rulesMap.set(employeeId, {
        dayOffStatus: Number.isFinite(dayOffStatus) ? dayOffStatus : 0,
        weekdays: new Set(parsedRule.weekdays),
        customDates: new Set(parsedRule.customDates),
      });
    });

    (Array.isArray(customDayoffs) ? customDayoffs : []).forEach((item) => {
      const passport = this.getLeaveHubPassportFromRecord(
        item,
        staffPassportById,
      );
      if (!passport || !employeeByPassport.has(passport)) {
        return;
      }

      const employeeId = employeeByPassport.get(passport);
      const existing = rulesMap.get(employeeId) || {
        dayOffStatus: 1,
        weekdays: new Set(),
        customDates: new Set(),
      };

      const dayOffStatus = Number(item?.dayOff_Status ?? item?.dayoff_status);
      if (Number.isFinite(dayOffStatus)) {
        existing.dayOffStatus = dayOffStatus;
      }

      const customDates = Array.isArray(item?.off_dates)
        ? item.off_dates
        : [item?.off_date, item?.date, item?.work_date];

      customDates.forEach((dateValue) => {
        const normalized = this.toDateString(dateValue);
        if (normalized) {
          existing.customDates.add(normalized);
        }
      });

      rulesMap.set(employeeId, existing);
    });

    return rulesMap;
  }

  isEmployeeWeeklyOffOnDate(employeeRules, workDate) {
    if (!employeeRules) return false;

    if (employeeRules.dayOffStatus === 1) {
      return employeeRules.customDates.has(workDate);
    }

    return employeeRules.weekdays.has(this.getWeekdayKey(workDate));
  }

  findNextAvailableWorkday(startDate, employeeRules, holidayList) {
    for (
      let index = 0;
      index < IntegrationService.COMPENSATION_SEARCH_LIMIT_DAYS;
      index += 1
    ) {
      const candidateDate = this.addDays(startDate, index);
      if (holidayList.has(candidateDate)) {
        continue;
      }

      if (this.isEmployeeWeeklyOffOnDate(employeeRules, candidateDate)) {
        continue;
      }

      return candidateDate;
    }

    return null;
  }

  buildLeavehubEventHash(event) {
    return DayResolutionService.buildSnapshotHash({
      employee_id: event.employee_id,
      work_date: event.work_date,
      day_type: event.day_type,
      source_system: "leavehub",
    });
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

  appendHolidayEventsToMap(holidays, eventsMap, allEmployeeIds, debug) {
    (Array.isArray(holidays) ? holidays : []).forEach((holiday) => {
      const holidayDates = this.resolveHolidayWorkDates(holiday);
      if (!holidayDates.length) {
        debug.holidays.skipped += 1;
        this.pushDebugSample(debug.holidays.details, {
          holiday_id: holiday?.id || null,
          name: holiday?.name || holiday?.holiday_name || null,
          input_date: holiday?.date || holiday?.holiday_date || null,
          lunar_date:
            holiday?.lunar_date ||
            holiday?.lunarDate ||
            holiday?.holiday_lunar_date ||
            null,
          status: "skipped",
          reason: "unresolved_holiday_date",
        });
        return;
      }

      debug.holidays.resolved += 1;
      this.pushDebugSample(debug.holidays.details, {
        holiday_id: holiday?.id || null,
        name: holiday?.name || holiday?.holiday_name || null,
        input_date: holiday?.date || holiday?.holiday_date || null,
        lunar_date:
          holiday?.lunar_date ||
          holiday?.lunarDate ||
          holiday?.holiday_lunar_date ||
          null,
        status: "resolved",
        resolved_dates: holidayDates,
      });

      const dayType = this.mapHolidayToDayType(holiday);

      holidayDates.forEach((holidayDate) => {
        allEmployeeIds.forEach((employeeId) => {
          this.setEventWithPriority(eventsMap, {
            employee_id: employeeId,
            work_date: holidayDate,
            day_type: dayType,
            leave_hours_data: null,
            priority: 2,
          });
        });
      });
    });
  }

  appendCompensatoryHolidayEventsToMap(
    holidays,
    eventsMap,
    allEmployeeIds,
    employeeRulesMap,
    debug,
  ) {
    const resolvedHolidayDates = new Set();

    (Array.isArray(holidays) ? holidays : []).forEach((holiday) => {
      const dates = this.resolveHolidayWorkDates(holiday);
      dates.forEach((dateValue) => resolvedHolidayDates.add(dateValue));
    });

    const blockedHolidayDates = new Set(resolvedHolidayDates);

    (Array.isArray(holidays) ? holidays : []).forEach((holiday) => {
      const holidayDates = this.resolveHolidayWorkDates(holiday);
      if (!holidayDates.length) {
        return;
      }

      holidayDates.forEach((holidayDate) => {
        allEmployeeIds.forEach((employeeId) => {
          const employeeRules = employeeRulesMap.get(employeeId);
          if (!this.isEmployeeWeeklyOffOnDate(employeeRules, holidayDate)) {
            return;
          }

          const nextWorkday = this.findNextAvailableWorkday(
            this.addDays(holidayDate, 1),
            employeeRules,
            blockedHolidayDates,
          );

          if (!nextWorkday) {
            this.pushDebugSample(debug.failed.reasons, {
              source: "holiday_compensation",
              reason: "next_workday_not_found",
              employee_id: employeeId,
              original_holiday_date: holidayDate,
              holiday: holiday?.name || holiday?.holiday_name || null,
            });
            return;
          }

          const originalHash = this.buildLeavehubEventHash({
            employee_id: employeeId,
            work_date: holidayDate,
            day_type: this.mapHolidayToDayType(holiday),
          });

          this.setEventWithPriority(eventsMap, {
            employee_id: employeeId,
            work_date: nextWorkday,
            day_type: "compensated_holiday",
            leave_hours_data: null,
            priority: 2,
            source_payload_hash: `${originalHash}`,
          });

          blockedHolidayDates.add(nextWorkday);
          this.pushDebugSample(debug.holidays.details, {
            holiday_id: holiday?.id || null,
            status: "generated_compensation",
            employee_id: employeeId,
            original_holiday_date: holidayDate,
            compensated_date: nextWorkday,
          });
        });
      });
    });
  }

  async upsertReconciledRosterEvents(
    shouldUseBulkUpsert,
    bulkUpsertPayloads,
    executor,
    debug,
  ) {
    if (shouldUseBulkUpsert) {
      const bulkResult = await IntegrationModel.upsertLeaveHubRostersBulk(
        bulkUpsertPayloads,
        executor,
      );

      debug.reconciled.batch_fallback_used = Boolean(bulkResult?.usedFallback);
      debug.reconciled.batches_executed = Number(
        bulkResult?.batchesExecuted || 0,
      );
      return;
    }

    for (const payload of bulkUpsertPayloads) {
      await IntegrationModel.upsertLeaveHubRoster(payload, executor);
    }

    debug.reconciled.batches_executed = bulkUpsertPayloads.length
      ? bulkUpsertPayloads.length
      : 0;
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
    const employeeRulesMap = this.buildEmployeeLeaveHubDayoffRules(
      syncPayload.staffs,
      syncPayload.custom_dayoffs,
      employeeByPassport,
      staffPassportById,
    );
    const leaveTypeMap = this.resolveLeaveTypeMap(syncPayload.leave_types);
    const eventsMap = new Map();
    let unmatchedRecords = 0;

    const debug = {
      received: this.summarizeSyncPayload(syncPayload),
      matched_employees: employeeByPassport.size,
      unmatched_records: {
        total: 0,
        samples: [],
      },
      holidays: {
        total: Array.isArray(syncPayload.holidays)
          ? syncPayload.holidays.length
          : 0,
        resolved: 0,
        skipped: 0,
        details: [],
      },
      reconciled: {
        total_events: 0,
        by_day_type: {},
        samples: [],
        upsert_mode: "single",
        batch_fallback_used: false,
        batches_executed: 0,
      },
      failed: {
        reasons: [],
      },
    };

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
        this.pushDebugSample(debug.unmatched_records.samples, {
          source: "leave_request",
          reason: "employee_not_matched_by_passport",
          record: leaveRequest,
        });
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
        this.pushDebugSample(debug.unmatched_records.samples, {
          source: "leave_request",
          reason: "missing_start_date",
          record: leaveRequest,
        });
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
        this.pushDebugSample(debug.unmatched_records.samples, {
          source: "swap_request",
          reason: "employee_not_matched_by_passport",
          record: swapRequest,
        });
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
        this.pushDebugSample(debug.unmatched_records.samples, {
          source: "swap_request",
          reason: "missing_work_date",
          record: swapRequest,
        });
        return;
      }

      this.setEventWithPriority(eventsMap, {
        employee_id: employeeId,
        work_date: workDate,
        day_type: "holiday_swap",
        leave_hours_data: null,
        priority: 3,
      });
    });

    (Array.isArray(syncPayload.custom_dayoffs)
      ? syncPayload.custom_dayoffs
      : []
    ).forEach((customDayoff) => {
      const dayOffStatus = Number(
        customDayoff?.dayOff_Status ?? customDayoff?.dayoff_status,
      );

      if (Number.isFinite(dayOffStatus) && dayOffStatus !== 1) {
        return;
      }

      const passport = this.getLeaveHubPassportFromRecord(
        customDayoff,
        staffPassportById,
      );

      if (!passport || !employeeByPassport.has(passport)) {
        unmatchedRecords += 1;
        this.pushDebugSample(debug.unmatched_records.samples, {
          source: "custom_dayoff",
          reason: "employee_not_matched_by_passport",
          record: customDayoff,
        });
        return;
      }

      const employeeId = employeeByPassport.get(passport);

      const customDates = Array.isArray(customDayoff?.off_dates)
        ? customDayoff.off_dates
        : [customDayoff?.off_date, customDayoff?.date, customDayoff?.work_date];

      if (!customDates.filter(Boolean).length) {
        this.pushDebugSample(debug.failed.reasons, {
          source: "custom_dayoff",
          reason: "missing_custom_dates",
          record: customDayoff,
        });
        return;
      }

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

    this.appendHolidayEventsToMap(
      syncPayload.holidays,
      eventsMap,
      allEmployeeIds,
      debug,
    );

    this.appendCompensatoryHolidayEventsToMap(
      syncPayload.holidays,
      eventsMap,
      allEmployeeIds,
      employeeRulesMap,
      debug,
    );

    const events = Array.from(eventsMap.values());
    debug.reconciled.total_events = events.length;

    const shouldUseBulkUpsert =
      allEmployeeIds.length >
      IntegrationService.BULK_ROSTER_UPSERT_EMPLOYEE_THRESHOLD;
    debug.reconciled.upsert_mode = shouldUseBulkUpsert ? "bulk" : "single";

    const affectedEmployeeIds = new Set();
    const fallbackDate = new Date().toISOString().slice(0, 10);
    let minDate = events[0]?.work_date || fallbackDate;
    let maxDate = events[0]?.work_date || fallbackDate;
    const bulkUpsertPayloads = [];

    for (const event of events) {
      affectedEmployeeIds.add(event.employee_id);

      debug.reconciled.by_day_type[event.day_type] =
        (debug.reconciled.by_day_type[event.day_type] || 0) + 1;
      this.pushDebugSample(debug.reconciled.samples, event);

      if (event.work_date < minDate) {
        minDate = event.work_date;
      }
      if (event.work_date > maxDate) {
        maxDate = event.work_date;
      }

      bulkUpsertPayloads.push({
        company_id: companyId,
        employee_id: event.employee_id,
        work_date: event.work_date,
        day_type: event.day_type,
        leave_hours_data: event.leave_hours_data,
        source_payload_hash:
          event.source_payload_hash || this.buildLeavehubEventHash(event),
      });
    }

    await this.upsertReconciledRosterEvents(
      shouldUseBulkUpsert,
      bulkUpsertPayloads,
      executor,
      debug,
    );

    const affectedSummaries =
      await IntegrationModel.recalculateAttendanceSummariesByEmployeeDateRange(
        companyId,
        Array.from(affectedEmployeeIds),
        minDate,
        maxDate,
        executor,
      );

    debug.unmatched_records.total = unmatchedRecords;

    return {
      reconciled_rosters: events.length,
      affected_summaries: affectedSummaries,
      matched_employees: employeeByPassport.size,
      unmatched_records: unmatchedRecords,
      debug,
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

  resolveRosterContextRange(query = {}) {
    const isValidIsoDate = (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

    if (query?.start_date && !isValidIsoDate(query.start_date)) {
      throw new AppError(
        "วันที่ start_date ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD",
        400,
      );
    }

    if (query?.end_date && !isValidIsoDate(query.end_date)) {
      throw new AppError("วันที่ end_date ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD", 400);
    }

    if (query?.month && !/^\d{4}-\d{2}$/.test(String(query.month))) {
      throw new AppError("รูปแบบเดือนต้องเป็น YYYY-MM", 400);
    }

    if (query?.start_date && query?.end_date) {
      return {
        startDate: query.start_date,
        endDate: query.end_date,
      };
    }

    const month = query?.month || new Date().toISOString().slice(0, 7);
    const [year, monthIndex] = String(month).split("-").map(Number);

    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 0));

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  getRosterContextPriority(type) {
    const priorityMap = {
      LEAVE: 1,
      HOLIDAY_SWAP: 2,
      WEEKLY_HOLIDAY: 3,
      HOLIDAY: 4,
      HOLIDAY_COMPENSATION: 5,
    };

    return priorityMap[type] || 999;
  }

  setContextEventWithPriority(map, key, eventPayload) {
    const current = map.get(key);
    if (!current || eventPayload.priority <= current.priority) {
      map.set(key, eventPayload);
    }
  }

  async getLeaveHubRosterContext(companyId, query = {}) {
    const normalizedCompanyId = Number(companyId);
    const { startDate, endDate } = this.resolveRosterContextRange(query);

    const integration =
      await IntegrationModel.findLeaveHubIntegration(normalizedCompanyId);

    if (integration?.status !== "active") {
      return {
        day_source: "local",
        connection_status: "not_connected",
        range: {
          start_date: startDate,
          end_date: endDate,
        },
        events_by_employee: [],
        global_events: [],
        mapped_employee_count: 0,
        unmapped_staff_count: 0,
      };
    }

    const credentials = this.getLeaveHubCredentialsFromIntegration(integration);
    const loginResult = await this.loginToLeaveHub(
      credentials.username,
      credentials.password,
    );

    const resolvedLeavehubCompanyId =
      Number(loginResult.leavehubCompanyId) || credentials.leavehubCompanyId;

    const syncPayload = await this.fetchLeaveHubSyncData(
      loginResult.token,
      resolvedLeavehubCompanyId,
    );

    const employees =
      await IntegrationModel.findEmployeesForLeaveHubMapping(
        normalizedCompanyId,
      );

    const employeeByPassport = new Map();
    employees.forEach((employee) => {
      const passport = this.normalizePassportValue(
        employee?.id_or_passport_number,
      );
      if (passport) {
        employeeByPassport.set(passport, Number(employee.id));
      }
    });

    const staffPassportById = this.buildStaffPassportMap(syncPayload.staffs);
    const employeeRulesMap = this.buildEmployeeLeaveHubDayoffRules(
      syncPayload.staffs,
      syncPayload.custom_dayoffs,
      employeeByPassport,
      staffPassportById,
    );

    const targetEmployeeId = query?.employee_id
      ? Number(query.employee_id)
      : null;

    const activeEmployeeIds = targetEmployeeId
      ? new Set([targetEmployeeId])
      : new Set(Array.from(employeeRulesMap.keys()));

    const leaveTypeMap = this.resolveLeaveTypeMap(syncPayload.leave_types);
    const eventsByEmployeeDate = new Map();
    const globalEventsByDate = new Map();
    const todayDate = new Date().toISOString().slice(0, 10);

    (Array.isArray(syncPayload.leave_requests)
      ? syncPayload.leave_requests
      : []
    ).forEach((leaveRequest) => {
      if (!this.isApprovedStatus(leaveRequest?.status)) return;

      const passport = this.getLeaveHubPassportFromRecord(
        leaveRequest,
        staffPassportById,
      );
      if (!passport || !employeeByPassport.has(passport)) return;

      const employeeId = employeeByPassport.get(passport);
      if (!activeEmployeeIds.has(employeeId)) return;

      const start = this.getDateCandidateFromRecord(leaveRequest, [
        "start_date",
        "date",
        "work_date",
      ]);
      const end =
        this.getDateCandidateFromRecord(leaveRequest, ["end_date"]) || start;

      if (!start || !end) return;

      const leaveTypeName =
        leaveTypeMap.get(String(leaveRequest?.leave_type_id)) ||
        leaveRequest?.leave_type_name ||
        null;

      this.expandDateRange(start, end).forEach((workDate) => {
        if (workDate < startDate || workDate > endDate) return;

        this.setContextEventWithPriority(
          eventsByEmployeeDate,
          `${employeeId}|${workDate}`,
          {
            employee_id: employeeId,
            work_date: workDate,
            type: "LEAVE",
            priority: this.getRosterContextPriority("LEAVE"),
            details: {
              leave_type_name: leaveTypeName,
              status: leaveRequest?.status || null,
              reason: leaveRequest?.reason || null,
              start_date: leaveRequest?.start_date || null,
              end_date: leaveRequest?.end_date || null,
              days_requested: leaveRequest?.days_requested || null,
              hours_requested: leaveRequest?.hours_requested || null,
              start_time: leaveRequest?.start_time || null,
              end_time: leaveRequest?.end_time || null,
              leave_request_id: leaveRequest?.id || null,
            },
          },
        );
      });
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
      if (!passport || !employeeByPassport.has(passport)) return;

      const employeeId = employeeByPassport.get(passport);
      if (!activeEmployeeIds.has(employeeId)) return;

      const workDate = this.getDateCandidateFromRecord(swapRequest, [
        "new_date",
        "date",
        "work_date",
      ]);
      if (!workDate || workDate < startDate || workDate > endDate) return;

      this.setContextEventWithPriority(
        eventsByEmployeeDate,
        `${employeeId}|${workDate}`,
        {
          employee_id: employeeId,
          work_date: workDate,
          type: "HOLIDAY_SWAP",
          priority: this.getRosterContextPriority("HOLIDAY_SWAP"),
          details: {
            holiday_name: swapRequest?.holiday_name || null,
            postpone_name: swapRequest?.postpone_name || null,
            original_date: swapRequest?.original_date || null,
            new_date: swapRequest?.new_date || null,
            status: swapRequest?.status || null,
            reason: swapRequest?.reason || null,
            swap_request_id: swapRequest?.id || null,
          },
        },
      );
    });

    const allDatesInRange = this.expandDateRange(startDate, endDate);
    Array.from(activeEmployeeIds).forEach((employeeId) => {
      const employeeRules = employeeRulesMap.get(Number(employeeId));
      if (!employeeRules) return;

      allDatesInRange.forEach((workDate) => {
        if (!this.isEmployeeWeeklyOffOnDate(employeeRules, workDate)) return;

        const isNormalWeeklyRule = Number(employeeRules.dayOffStatus) !== 1;
        if (isNormalWeeklyRule && workDate < todayDate) return;

        this.setContextEventWithPriority(
          eventsByEmployeeDate,
          `${employeeId}|${workDate}`,
          {
            employee_id: Number(employeeId),
            work_date: workDate,
            type: "WEEKLY_HOLIDAY",
            priority: this.getRosterContextPriority("WEEKLY_HOLIDAY"),
            details: {
              source:
                Number(employeeRules.dayOffStatus) === 1
                  ? "custom_dayoff"
                  : "staff_dayoff",
            },
          },
        );
      });
    });

    const resolvedHolidayDates = new Set();
    const publicHolidayRefs = [];

    (Array.isArray(syncPayload.holidays) ? syncPayload.holidays : []).forEach(
      (holiday) => {
        const holidayDates = this.resolveHolidayWorkDates(holiday);
        if (!holidayDates.length) return;

        const isCompensatory =
          this.mapHolidayToDayType(holiday) === "compensated_holiday";
        const eventType = isCompensatory ? "HOLIDAY_COMPENSATION" : "HOLIDAY";

        holidayDates.forEach((workDate) => {
          if (workDate < startDate || workDate > endDate) return;

          resolvedHolidayDates.add(workDate);
          if (!isCompensatory) {
            publicHolidayRefs.push({
              work_date: workDate,
              holiday_name: holiday?.holiday_name || holiday?.name || null,
              holiday_id: holiday?.id || null,
            });
          }

          this.setContextEventWithPriority(globalEventsByDate, workDate, {
            work_date: workDate,
            type: eventType,
            priority: this.getRosterContextPriority(eventType),
            details: {
              holiday_name: holiday?.holiday_name || holiday?.name || null,
              holiday_date: workDate,
              holiday_id: holiday?.id || null,
              source: "holidays",
              ...(isCompensatory
                ? {
                    compensation_from_date:
                      holiday?.compensation_from_date || null,
                  }
                : {}),
            },
          });
        });
      },
    );

    Array.from(activeEmployeeIds).forEach((employeeId) => {
      const employeeRules = employeeRulesMap.get(Number(employeeId));
      if (!employeeRules) return;

      const blockedHolidayDates = new Set(resolvedHolidayDates);

      publicHolidayRefs.forEach((holidayRef) => {
        if (
          !this.isEmployeeWeeklyOffOnDate(employeeRules, holidayRef.work_date)
        ) {
          return;
        }

        const nextCompensatedDate = this.findNextAvailableWorkday(
          this.addDays(holidayRef.work_date, 1),
          employeeRules,
          blockedHolidayDates,
        );

        if (
          !nextCompensatedDate ||
          nextCompensatedDate < startDate ||
          nextCompensatedDate > endDate
        ) {
          return;
        }

        this.setContextEventWithPriority(
          eventsByEmployeeDate,
          `${employeeId}|${nextCompensatedDate}`,
          {
            employee_id: Number(employeeId),
            work_date: nextCompensatedDate,
            type: "HOLIDAY_COMPENSATION",
            priority: this.getRosterContextPriority("HOLIDAY_COMPENSATION"),
            details: {
              source: "generated_compensation",
              holiday_name: holidayRef.holiday_name,
              holiday_id: holidayRef.holiday_id,
              original_date: holidayRef.work_date,
              compensation_from_date: holidayRef.work_date,
            },
          },
        );

        blockedHolidayDates.add(nextCompensatedDate);
      });
    });

    const totalStaffs = Array.isArray(syncPayload?.staffs)
      ? syncPayload.staffs.length
      : 0;

    return {
      day_source: "leave_hub",
      connection_status: "connected",
      range: {
        start_date: startDate,
        end_date: endDate,
      },
      events_by_employee: Array.from(eventsByEmployeeDate.values()).map(
        ({ priority, ...rest }) => rest,
      ),
      global_events: Array.from(globalEventsByDate.values()).map(
        ({ priority, ...rest }) => rest,
      ),
      mapped_employee_count: activeEmployeeIds.size,
      unmapped_staff_count: Math.max(0, totalStaffs - employeeByPassport.size),
    };
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
