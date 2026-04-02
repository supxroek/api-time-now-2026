const axios = require("axios");
const crypto = require("node:crypto");
const AppError = require("../../../utils/AppError");
const db = require("../../../config/db.config");
const { normalizeDate } = require("../../../utils/date");
const DayResolutionModel = require("./day_resolution.model");

const {
  LEAVE_HUB_LOGIN_URL = "https://apiv2-tnlncwsaha-as.a.run.app/login",
  LEAVE_HUB_STAFF_URL = "https://apiv2-tnlncwsaha-as.a.run.app/staff/staff",
} = process.env;

class DayResolutionService {
  static WEEKDAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  normalizePassportValue(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized || null;
  }

  normalizeWorkDate(inputDate) {
    const workDate = normalizeDate(inputDate);
    if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      throw new AppError("วันที่ไม่ถูกต้อง ต้องเป็นรูปแบบ YYYY-MM-DD", 400);
    }
    return workDate;
  }

  getWeekdayKey(workDate) {
    const [year, month, day] = String(workDate).split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return DayResolutionService.WEEKDAY_KEYS[weekday];
  }

  getCredentialSecret() {
    const secret =
      process.env.LEAVE_HUB_CREDENTIAL_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError("ระบบยังไม่ได้ตั้งค่า secret สำหรับการถอดรหัส", 500);
    }
    return secret;
  }

  parseCredentialPayload(value) {
    if (!value) return null;
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value;
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

  getAttendanceStatusFromDayType(dayType) {
    if (
      [
        "weekly_off",
        "public_holiday",
        "compensated_holiday",
        "holiday_swap",
      ].includes(dayType)
    ) {
      return "holiday";
    }

    if (
      [
        "annual_leave",
        "sick_leave",
        "private_leave",
        "unpaid_leave",
        "other_leave",
      ].includes(dayType)
    ) {
      return "leave";
    }

    return "incomplete";
  }

  parseWeeklyDays(value) {
    if (!value) return [];

    let parsed = value;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = String(value)
          .split(/[,|;]/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    const source = Array.isArray(parsed) ? parsed : [];

    return source
      .map((token) => String(token).trim().toUpperCase())
      .map((token) => {
        if (["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].includes(token)) {
          return token;
        }

        const short = token.slice(0, 3);
        if (["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].includes(short)) {
          return short;
        }

        return null;
      })
      .filter(Boolean);
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

      if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
        customDates.push(token);
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

  async fetchLeavehubStaffProfiles(companyId) {
    const integration =
      await DayResolutionModel.findLeaveHubIntegration(companyId);

    if (integration?.status !== "active") {
      return {
        integration,
        rulesMap: new Map(),
      };
    }

    if (!LEAVE_HUB_LOGIN_URL || !LEAVE_HUB_STAFF_URL) {
      throw new AppError(
        "ยังไม่ได้ตั้งค่า Leavehub endpoint สำหรับ Day Resolution",
        500,
      );
    }

    const payload = this.parseCredentialPayload(integration.credential_payload);
    if (!payload) {
      throw new AppError("ไม่พบข้อมูล credential ของ Leavehub", 400);
    }

    const username = this.decryptCredentialValue(payload.username);
    const password = this.decryptCredentialValue(payload.password);

    const loginResponse = await axios.post(
      LEAVE_HUB_LOGIN_URL,
      { username, password },
      { timeout: 15000 },
    );

    const loginPayload = loginResponse?.data?.data || loginResponse?.data || {};
    const token =
      loginPayload.token ||
      loginPayload.accessToken ||
      loginPayload.access_token ||
      loginPayload.jwt;

    if (!token) {
      throw new AppError("Leavehub ไม่ส่ง token กลับมา", 502);
    }

    const staffResponse = await axios.get(LEAVE_HUB_STAFF_URL, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    let staffs = [];
    if (Array.isArray(staffResponse?.data)) {
      staffs = staffResponse.data;
    } else if (Array.isArray(staffResponse?.data?.data)) {
      staffs = staffResponse.data.data;
    }

    const rulesMap = new Map();

    staffs.forEach((staff) => {
      const passport = this.normalizePassportValue(
        staff?.ID_or_Passport_Number ||
          staff?.id_or_passport_number ||
          staff?.idOrPassportNumber,
      );
      if (!passport) return;

      const dayOffStatus = Number(
        staff?.dayOff_Status ?? staff?.dayoff_status ?? 0,
      );
      const parsedRule = this.parseLeavehubDayOffRule(
        staff?.dayOff ?? staff?.dayoff,
      );

      rulesMap.set(passport, {
        dayOffStatus,
        weekdays: parsedRule.weekdays,
        customDates: parsedRule.customDates,
      });
    });

    return {
      integration,
      rulesMap,
    };
  }

  async resolveLocalDynamicDayType(companyId, employeeId, workDate) {
    const assignment = await DayResolutionModel.findEffectiveDayoffAssignment(
      companyId,
      employeeId,
      workDate,
    );

    if (!assignment) {
      return "workday";
    }

    if (assignment.dayoff_mode === "custom") {
      const customDay = await DayResolutionModel.findCustomDayoffByDate(
        companyId,
        employeeId,
        workDate,
      );
      return customDay ? "weekly_off" : "workday";
    }

    const weeklyDays = this.parseWeeklyDays(assignment.weekly_days);
    return weeklyDays.includes(this.getWeekdayKey(workDate))
      ? "weekly_off"
      : "workday";
  }

  async resolveDynamicDayType(
    companyId,
    employee,
    workDate,
    leavehubRulesContext = null,
  ) {
    const passport = this.normalizePassportValue(
      employee.id_or_passport_number,
    );

    if (leavehubRulesContext?.integration?.status === "active") {
      if (!passport) {
        return "workday";
      }

      const leavehubRule = leavehubRulesContext.rulesMap.get(passport);

      if (leavehubRule) {
        if (leavehubRule.dayOffStatus === 1) {
          return leavehubRule.customDates.includes(workDate)
            ? "weekly_off"
            : "workday";
        }

        if (leavehubRule.weekdays.includes(this.getWeekdayKey(workDate))) {
          return "weekly_off";
        }

        return "workday";
      }

      return "workday";
    }

    return this.resolveLocalDynamicDayType(companyId, employee.id, workDate);
  }

  async resolveShiftIdForDate(companyId, employeeId, workDate, executor = db) {
    const shiftAssignment =
      await DayResolutionModel.findEffectiveShiftAssignment(
        companyId,
        employeeId,
        workDate,
        executor,
      );

    if (!shiftAssignment) {
      return null;
    }

    if (shiftAssignment.shift_mode === "normal") {
      return shiftAssignment.shift_id || null;
    }

    const customShift = await DayResolutionModel.findCustomShiftByDate(
      companyId,
      employeeId,
      workDate,
      executor,
    );

    return customShift?.shift_id || null;
  }

  buildSnapshotHash(payload) {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          employee_id: payload.employee_id,
          work_date: payload.work_date,
          day_type: payload.day_type,
          source_system: payload.source_system,
        }),
      )
      .digest("hex");
  }

  async resolveEmployeeDay(
    companyId,
    employeeId,
    dateInput,
    leavehubRulesContext = null,
  ) {
    const workDate = this.normalizeWorkDate(dateInput);
    const employee = await DayResolutionModel.findEmployeeById(
      companyId,
      employeeId,
    );

    if (!employee) {
      throw new AppError("ไม่พบพนักงานในบริษัทนี้", 404);
    }

    const roster = await DayResolutionModel.findRosterByEmployeeAndDate(
      companyId,
      employeeId,
      workDate,
    );

    if (roster && roster.day_type !== "workday") {
      return {
        employee_id: Number(employeeId),
        work_date: workDate,
        day_type: roster.day_type,
        source_system: roster.source_system,
        roster_id: roster.id,
        is_dynamic: false,
      };
    }

    if (roster?.day_type === "workday") {
      return {
        employee_id: Number(employeeId),
        work_date: workDate,
        day_type: "workday",
        source_system: roster.source_system,
        roster_id: roster.id,
        is_dynamic: false,
      };
    }

    const dayType = await this.resolveDynamicDayType(
      companyId,
      employee,
      workDate,
      leavehubRulesContext,
    );

    return {
      employee_id: Number(employeeId),
      work_date: workDate,
      day_type: dayType,
      source_system:
        leavehubRulesContext?.integration?.status === "active"
          ? "leavehub"
          : "local",
      roster_id: null,
      is_dynamic: true,
    };
  }

  async getCompanyDaySnapshots(companyId, query = {}) {
    const workDate = this.normalizeWorkDate(query.date);
    const employeeId = query.employee_id ? Number(query.employee_id) : null;

    const employees = await DayResolutionModel.findActiveEmployeesByCompany(
      companyId,
      employeeId,
    );

    const leavehubRulesContext =
      await this.fetchLeavehubStaffProfiles(companyId);

    const snapshots = await Promise.all(
      employees.map((employee) =>
        this.resolveEmployeeDay(
          companyId,
          employee.id,
          workDate,
          leavehubRulesContext,
        ),
      ),
    );

    return {
      work_date: workDate,
      snapshots,
    };
  }

  async getEmployeeDayResolution(companyId, employeeId, query = {}) {
    const workDate = this.normalizeWorkDate(query.date);
    const leavehubRulesContext =
      await this.fetchLeavehubStaffProfiles(companyId);
    const resolution = await this.resolveEmployeeDay(
      companyId,
      employeeId,
      workDate,
      leavehubRulesContext,
    );

    return { resolution };
  }

  async createJitSnapshot(companyId, userId, payload, ipAddress) {
    const employeeId = Number(payload?.employee_id);
    const workDate = this.normalizeWorkDate(payload?.work_date);
    const triggerType = String(payload?.trigger_type || "manual");

    if (!employeeId) {
      throw new AppError("กรุณาระบุ employee_id", 400);
    }

    const leavehubRulesContext =
      await this.fetchLeavehubStaffProfiles(companyId);
    const preResolved = await this.resolveEmployeeDay(
      companyId,
      employeeId,
      workDate,
      leavehubRulesContext,
    );

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const existingRoster =
        await DayResolutionModel.findRosterByEmployeeAndDate(
          companyId,
          employeeId,
          workDate,
          connection,
          true,
        );

      if (existingRoster) {
        await connection.commit();
        return {
          created: false,
          roster_id: existingRoster.id,
          day_type: existingRoster.day_type,
          source_system: existingRoster.source_system,
          is_dynamic: false,
        };
      }

      const shiftId = await this.resolveShiftIdForDate(
        companyId,
        employeeId,
        workDate,
        connection,
      );

      const rosterId = await DayResolutionModel.insertRosterSnapshot(
        {
          company_id: companyId,
          employee_id: employeeId,
          work_date: workDate,
          shift_id: shiftId,
          day_type: preResolved.day_type,
          source_system: preResolved.source_system,
          leave_hours_data: null,
          is_ot_allowed: 0,
          source_payload_hash: this.buildSnapshotHash({
            employee_id: employeeId,
            work_date: workDate,
            day_type: preResolved.day_type,
            source_system: preResolved.source_system,
          }),
        },
        connection,
      );

      await DayResolutionModel.upsertAttendanceSummaryFromRoster(
        {
          company_id: companyId,
          employee_id: employeeId,
          roster_id: rosterId,
          work_date: workDate,
          attendance_status: this.getAttendanceStatusFromDayType(
            preResolved.day_type,
          ),
        },
        connection,
      );

      await DayResolutionModel.insertAuditTrail(
        {
          company_id: companyId,
          user_id: userId,
          action_type: "INSERT",
          table_name: "rosters",
          record_id: rosterId,
          old_values: null,
          new_values: {
            employee_id: employeeId,
            work_date: workDate,
            day_type: preResolved.day_type,
            source_system: preResolved.source_system,
            trigger_type: triggerType,
            shift_id: shiftId,
          },
          ip_address: ipAddress,
        },
        connection,
      );

      await connection.commit();

      return {
        created: true,
        roster_id: rosterId,
        day_type: preResolved.day_type,
        source_system: preResolved.source_system,
        is_dynamic: false,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new DayResolutionService();
