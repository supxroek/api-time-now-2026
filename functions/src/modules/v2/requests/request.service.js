const jwt = require("jsonwebtoken");
const AppError = require("../../../utils/AppError");
const db = require("../../../config/db.config");
const StatsService = require("../stats/stats.service");
const RequestModel = require("./request.model");
const { sendMailApi } = require("../../../providers/mail.provider");

const APPROVAL_FLOW_KEY = "approval_flow";
const APPROVAL_TOKEN_PURPOSE = "request_approval";

class RequestService {
  static REQUEST_TYPE_LABELS = {
    correction: "แก้ไขเวลา",
    ot: "ขอ OT",
    shift_swap: "ขอสลับกะ",
  };

  static STATUS_LABELS = {
    pending: "รออนุมัติ",
    approved: "อนุมัติแล้ว",
    rejected: "ปฏิเสธ",
  };

  static ALLOWED_REQUEST_TYPES = Object.keys(
    RequestService.REQUEST_TYPE_LABELS,
  );

  static ALLOWED_STATUSES = Object.keys(RequestService.STATUS_LABELS);

  normalizePositiveInt(
    value,
    fallback,
    { min = 1, max = Number.MAX_SAFE_INTEGER } = {},
  ) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) return fallback;
    const integer = Math.floor(parsed);
    if (integer < min) return fallback;
    return Math.min(integer, max);
  }

  normalizeDate(value, fieldName) {
    if (!value) return undefined;
    const dateString = String(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      throw new AppError(`${fieldName} ต้องอยู่ในรูปแบบ YYYY-MM-DD`, 400);
    }
    return dateString;
  }

  normalizeRequestType(value) {
    if (!value) return undefined;
    if (!RequestService.ALLOWED_REQUEST_TYPES.includes(value)) {
      throw new AppError("request_type ไม่ถูกต้อง", 400);
    }
    return value;
  }

  normalizeStatusList(value) {
    if (!value) return [];

    const statusList = String(value)
      .split(",")
      .map((status) => status.trim())
      .filter(Boolean);

    if (statusList.length === 0) return [];

    const invalid = statusList.find(
      (status) => !RequestService.ALLOWED_STATUSES.includes(status),
    );

    if (invalid) {
      throw new AppError("status ไม่ถูกต้อง", 400);
    }

    return [...new Set(statusList)];
  }

  toEnumObject(key, labels) {
    if (!key) return null;
    return {
      key,
      label: labels[key] || key,
    };
  }

  buildRequestTypeLabel(requestTypeKey) {
    return RequestService.REQUEST_TYPE_LABELS[requestTypeKey] || requestTypeKey;
  }

  buildRoleLabel(roleKey) {
    const labels = {
      super_admin: "Super Admin",
      admin: "Admin",
      manager: "Manager",
    };
    return labels[roleKey] || roleKey;
  }

  buildStageLabel(category) {
    const labels = {
      department_head: "หัวหน้าแผนก",
      admin: "Admin",
      super_admin: "Super Admin",
    };

    return labels[category] || category;
  }

  formatThaiDate(dateValue) {
    if (!dateValue) return "-";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeZone: "Asia/Bangkok",
    }).format(date);
  }

  buildRequestSummaryLine(requestRow, requestData) {
    const requestType = requestRow.request_type;

    if (requestType === "correction") {
      const logType = requestData?.log_type || "-";
      const time = requestData?.time || "-";
      return `คำขอแก้ไขเวลา: ${logType} เวลา ${time}`;
    }

    if (requestType === "ot") {
      return `คำขอ OT: ${requestRow.ot_template_name || "ขอ OT"}`;
    }

    if (requestType === "shift_swap") {
      const fromShift = requestRow.from_shift_name || "-";
      const toShift = requestRow.to_shift_name || "-";
      return `คำขอสลับกะ: ${fromShift} -> ${toShift}`;
    }

    return "มีคำขอรอการพิจารณา";
  }

  buildReviewUrl() {
    const webBaseUrl = process.env.WEB_BASE_URL || "http://localhost:5173";
    const normalizedBase = String(webBaseUrl).endsWith("/")
      ? String(webBaseUrl).slice(0, -1)
      : String(webBaseUrl);

    return `${normalizedBase}/requests`;
  }

  buildApprovalPageUrl(token) {
    const webBaseUrl =
      process.env.WEB_BASE_URL || "https://cms-timesnow-2024.web.app";
    const normalizedBase = String(webBaseUrl).endsWith("/")
      ? String(webBaseUrl).slice(0, -1)
      : String(webBaseUrl);

    return `${normalizedBase}/request-approval/${encodeURIComponent(token)}`;
  }

  buildApprovalToken(step, requestRow) {
    const secret =
      process.env.JWT_REQUEST_APPROVAL_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError("ระบบยังไม่ได้ตั้งค่า JWT secret", 500);
    }

    return jwt.sign(
      {
        purpose: APPROVAL_TOKEN_PURPOSE,
        request_id: requestRow.id,
        company_id: requestRow.company_id,
        approver_user_id: step.user_id,
        step_order: step.order,
      },
      secret,
      {
        expiresIn: process.env.JWT_REQUEST_APPROVAL_EXPIRES_IN || "3d",
      },
    );
  }

  verifyApprovalToken(token) {
    const secret =
      process.env.JWT_REQUEST_APPROVAL_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError("ระบบยังไม่ได้ตั้งค่า JWT secret", 500);
    }

    const decoded = jwt.verify(token, secret);
    if (decoded?.purpose !== APPROVAL_TOKEN_PURPOSE) {
      throw new AppError(
        "ลิงก์อนุมัติไม่ถูกต้อง",
        400,
        "APPROVAL_TOKEN_INVALID",
      );
    }

    return decoded;
  }

  normalizeRequestData(requestData) {
    if (requestData === null || requestData === undefined) {
      return null;
    }

    if (typeof requestData === "string") {
      try {
        return JSON.parse(requestData);
      } catch (error) {
        console.error("Failed to parse request_data:", error);
        return null;
      }
    }

    return requestData;
  }

  extractApprovalFlow(requestData) {
    if (!requestData || typeof requestData !== "object") {
      return null;
    }

    const flow = requestData[APPROVAL_FLOW_KEY];
    if (!flow || typeof flow !== "object") {
      return null;
    }

    if (!Array.isArray(flow.steps) || flow.steps.length === 0) {
      return null;
    }

    return flow;
  }

  attachApprovalFlow(requestData, flow) {
    const currentData =
      requestData && typeof requestData === "object" ? { ...requestData } : {};
    currentData[APPROVAL_FLOW_KEY] = flow;
    return currentData;
  }

  buildApprovalSteps(requestRow, candidates) {
    const users = Array.isArray(candidates?.users) ? candidates.users : [];
    const requesterDepartmentId =
      Number(candidates?.requester?.department_id) || null;
    const selectedIds = new Set();
    const steps = [];

    const findCandidate = (rule) =>
      users.find((candidate) => {
        if (selectedIds.has(candidate.id)) return false;
        if (
          candidate.employee_id &&
          Number(candidate.employee_id) === Number(requestRow.employee_id)
        ) {
          return false;
        }
        return rule(candidate);
      });

    const addStep = (candidate, category) => {
      if (!candidate) return;

      const email = candidate.resolved_email || null;
      if (!email) {
        throw new AppError(
          `ไม่พบอีเมลสำหรับตำแหน่ง ${this.buildStageLabel(category)} จึงไม่สามารถส่งคำขออนุมัติได้`,
          400,
          "APPROVER_EMAIL_NOT_FOUND",
        );
      }

      selectedIds.add(candidate.id);
      steps.push({
        order: steps.length + 1,
        user_id: candidate.id,
        employee_id: candidate.employee_id || null,
        email,
        role: candidate.role,
        role_label: this.buildRoleLabel(candidate.role),
        stage_label: this.buildStageLabel(category),
        category,
        status: "pending",
        approved_at: null,
      });
    };

    const departmentHead = findCandidate(
      (user) =>
        !!requesterDepartmentId &&
        Number(user.is_department_head) === 1 &&
        Number(user.employee_department_id) === requesterDepartmentId,
    );

    // ถ้าไม่มีหัวหน้าแผนก จะเริ่มส่งที่ Admin ตาม policy ใหม่
    addStep(departmentHead, "department_head");

    const admin = findCandidate((user) => user.role === "admin");
    if (!admin) {
      throw new AppError(
        "ไม่พบผู้ใช้งานตำแหน่ง Admin สำหรับกระบวนการอนุมัติ",
        400,
        "ADMIN_NOT_FOUND",
      );
    }
    addStep(admin, "admin");

    const superAdmin = findCandidate((user) => user.role === "super_admin");
    if (!superAdmin) {
      throw new AppError(
        "ไม่พบผู้ใช้งานตำแหน่ง Super Admin สำหรับกระบวนการอนุมัติ",
        400,
        "SUPER_ADMIN_NOT_FOUND",
      );
    }
    addStep(superAdmin, "super_admin");

    if (steps.length === 0) {
      throw new AppError(
        "ไม่พบผู้อนุมัติที่เข้าเงื่อนไขสำหรับคำขอนี้",
        400,
        "APPROVAL_CHAIN_EMPTY",
      );
    }

    return steps;
  }

  buildApprovalFlow(requestRow, candidates) {
    const now = new Date().toISOString();
    return {
      version: 1,
      current_step_order: 1,
      created_at: now,
      updated_at: now,
      completed_at: null,
      steps: this.buildApprovalSteps(requestRow, candidates),
    };
  }

  findCurrentStep(flow) {
    if (!flow || !Array.isArray(flow.steps)) return null;

    return (
      flow.steps.find((step) => step.order === flow.current_step_order) || null
    );
  }

  getStepByToken(flow, tokenPayload) {
    if (!flow || !Array.isArray(flow.steps)) return null;

    return (
      flow.steps.find(
        (step) =>
          step.order === Number(tokenPayload.step_order) &&
          step.user_id === Number(tokenPayload.approver_user_id),
      ) || null
    );
  }

  mapRequestRow(row) {
    const requestData = this.normalizeRequestData(row.request_data);
    const approvalFlow = this.extractApprovalFlow(requestData);

    return {
      id: row.id,
      company_id: row.company_id,
      request_type: this.toEnumObject(
        row.request_type,
        RequestService.REQUEST_TYPE_LABELS,
      ),
      status: this.toEnumObject(row.status, RequestService.STATUS_LABELS),
      target_date: row.target_date,
      roster_id: row.roster_id,
      ot_template_id: row.ot_template_id,
      created_at: row.created_at,
      approved_at: row.approved_at,
      rejected_reason: row.rejected_reason,
      evidence_image: row.evidence_image || null,
      request_data: requestData,
      approval_flow: approvalFlow,
      employee: {
        id: row.employee_id,
        code: row.employee_code,
        name: row.employee_name,
        avatar: row.employee_avatar,
      },
      approver: row.approver_id
        ? {
            id: row.approver_id,
            name: row.approver_name,
          }
        : null,
      ot_template: row.ot_template_id
        ? {
            id: row.ot_template_id,
            name: row.ot_template_name,
            start_time: row.ot_start_time,
            end_time: row.ot_end_time,
            duration_minutes: row.ot_duration_minutes,
            overtime_rate: row.ot_overtime_rate,
          }
        : null,
      shift_swap: {
        from: row.from_shift_id
          ? {
              id: row.from_shift_id,
              name: row.from_shift_name,
              time: {
                start: row.from_shift_start_time,
                end: row.from_shift_end_time,
              },
            }
          : null,
        to: row.to_shift_id
          ? {
              id: row.to_shift_id,
              name: row.to_shift_name,
              time: {
                start: row.to_shift_start_time,
                end: row.to_shift_end_time,
              },
            }
          : null,
        shift_swap: {
          from_shift: row.from_shift_id || requestData?.from_shift || null,
          to_shift: row.to_shift_id || requestData?.to_shift || null,
        },
      },
    };
  }

  async getRequestList(companyId, query) {
    const page = this.normalizePositiveInt(query.page, 1, {
      min: 1,
      max: 100000,
    });
    const limit = this.normalizePositiveInt(query.limit, 50, {
      min: 1,
      max: 200,
    });
    const offset = (page - 1) * limit;

    const targetDateFrom = this.normalizeDate(
      query.target_date_from,
      "target_date_from",
    );
    const targetDateTo = this.normalizeDate(
      query.target_date_to,
      "target_date_to",
    );

    if (targetDateFrom && targetDateTo && targetDateFrom > targetDateTo) {
      throw new AppError(
        "target_date_from ต้องน้อยกว่าหรือเท่ากับ target_date_to",
        400,
      );
    }

    const filters = {
      employee_id: query.employee_id,
      status_list: this.normalizeStatusList(query.status),
      request_type: this.normalizeRequestType(query.request_type),
      target_date_from: targetDateFrom,
      target_date_to: targetDateTo,
      search: query.search?.trim(),
    };

    const [rows, total] = await Promise.all([
      RequestModel.findAll(companyId, filters, limit, offset),
      RequestModel.countAll(companyId, filters),
    ]);

    return {
      requests: rows.map((row) => this.mapRequestRow(row)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
      generated_at: new Date().toISOString(),
    };
  }

  async getRequestById(companyId, requestId) {
    const row = await RequestModel.findById(requestId, companyId);
    if (!row) {
      throw new AppError("ไม่พบข้อมูลคำขอ", 404);
    }

    return this.mapRequestRow(row);
  }

  async getRequestStats(companyId) {
    const statsOverview = await StatsService.getOverview(companyId);
    const requestStats = statsOverview?.requests || {};

    return {
      stats: {
        total: Number(requestStats.total_requests || 0),
        pending: Number(requestStats.pending || 0),
        approved: Number(requestStats.approved || 0),
        rejected: Number(requestStats.rejected || 0),
      },
      generated_at: new Date().toISOString(),
    };
  }

  async ensureWorkflowExists(requestRow, { connection = null } = {}) {
    const requestData =
      this.normalizeRequestData(requestRow.request_data) || {};
    let flow = this.extractApprovalFlow(requestData);

    if (flow) {
      return {
        flow,
        requestData,
      };
    }

    const candidates = await RequestModel.findApprovalCandidates(
      requestRow.company_id,
      requestRow.employee_id,
      connection,
    );

    flow = this.buildApprovalFlow(requestRow, candidates);
    const nextRequestData = this.attachApprovalFlow(requestData, flow);

    await RequestModel.updateWorkflowState(
      requestRow.id,
      requestRow.company_id,
      {
        requestData: nextRequestData,
        status: requestRow.status,
        approverId: requestRow.approver_id || null,
        approvedAt: requestRow.approved_at || null,
      },
      connection,
    );

    return {
      flow,
      requestData: nextRequestData,
    };
  }

  buildApprovalActionEmailHtml({
    recipientName,
    requestTypeLabel,
    employeeName,
    employeeCode,
    targetDate,
    summary,
    reason,
    approveUrl,
    requestId,
    currentStageLabel,
  }) {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="margin: 0 0 12px;">คำขอรอการอนุมัติ (${currentStageLabel})</h2>
        <p style="margin: 0 0 12px;">เรียน ${recipientName || "ผู้อนุมัติ"}</p>
        <p style="margin: 0 0 8px;">มีคำขอที่ต้องอนุมัติในลำดับของคุณ กรุณาตรวจสอบ:</p>
        <ul style="margin: 0 0 16px; padding-left: 18px;">
          <li>เลขที่คำขอ: #${requestId}</li>
          <li>ประเภทคำขอ: ${requestTypeLabel}</li>
          <li>พนักงาน: ${employeeName || "-"} (${employeeCode || "-"})</li>
          <li>วันที่ที่เกี่ยวข้อง: ${targetDate}</li>
          <li>รายละเอียด: ${summary}</li>
          <li>เหตุผล: ${reason || "-"}</li>
        </ul>
        <p style="margin: 0 0 16px;">
          <a href="${approveUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 8px;">
            เปิดลิงก์อนุมัติ
          </a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">หากปุ่มไม่ทำงาน ให้เปิดลิงก์นี้: ${approveUrl}</p>
      </div>
    `;
  }

  async notifyCurrentStepApprover(requestRow, flow, requestData) {
    const currentStep = this.findCurrentStep(flow);
    if (!currentStep) {
      return {
        sent_count: 0,
        recipient_count: 0,
        reason: "CURRENT_STEP_NOT_FOUND",
      };
    }

    if (currentStep.status !== "pending") {
      return {
        sent_count: 0,
        recipient_count: 0,
        reason: "CURRENT_STEP_ALREADY_APPROVED",
      };
    }

    const isFinalStep = flow.steps.every(
      (step) => step.order <= currentStep.order || step.status === "approved",
    );

    const token = this.buildApprovalToken(currentStep, requestRow);
    const approveUrl = this.buildApprovalPageUrl(token);
    const requestTypeLabel = this.buildRequestTypeLabel(
      requestRow.request_type,
    );
    const targetDate = this.formatThaiDate(
      requestRow.target_date || requestData?.date || requestData?.work_date,
    );
    const summary = this.buildRequestSummaryLine(requestRow, requestData);

    const subject = `[Timesnow] กรุณาอนุมัติคำขอ #${requestRow.id}`;
    const html = this.buildApprovalActionEmailHtml({
      recipientName: currentStep.role_label,
      requestTypeLabel,
      employeeName: requestRow.employee_name,
      employeeCode: requestRow.employee_code,
      targetDate,
      summary,
      reason: requestData?.reason,
      approveUrl,
      requestId: requestRow.id,
      currentStageLabel: currentStep.stage_label,
    });

    await sendMailApi({
      to: currentStep.email,
      subject,
      html,
    });

    return {
      sent_count: 1,
      recipient_count: 1,
      current_step_order: currentStep.order,
      current_stage_label: currentStep.stage_label,
      current_step_status: currentStep.status,
      is_final_step: isFinalStep,
    };
  }

  async resendNotification(companyId, requestId, _actorUserId) {
    const row = await RequestModel.findById(requestId, companyId);
    if (!row) {
      throw new AppError("ไม่พบข้อมูลคำขอ", 404);
    }

    if (row.status !== "pending") {
      throw new AppError(
        "ส่งแจ้งเตือนซ้ำได้เฉพาะคำขอที่รออนุมัติเท่านั้น",
        400,
      );
    }

    // Proxy to BOT's internal API for unified email format
    const axios = require("axios");
    const botApiUrl = process.env.BOT_API_URL;
    const internalApiKey = process.env.INTERNAL_API_KEY;

    if (!botApiUrl || !internalApiKey) {
      throw new AppError(
        "ระบบยังไม่ได้ตั้งค่า BOT_API_URL หรือ INTERNAL_API_KEY",
        500,
      );
    }

    try {
      const response = await axios.post(
        `${botApiUrl}/api/internal/requests/${requestId}/resend-notification`,
        {},
        {
          headers: { "X-Internal-API-Key": internalApiKey },
          timeout: 15000,
        },
      );

      return response.data.data;
    } catch (err) {
      if (err.response?.data?.message) {
        throw new AppError(
          err.response.data.message,
          err.response.status || 502,
        );
      }
      throw new AppError("ไม่สามารถส่งแจ้งเตือนซ้ำได้", 502);
    }
  }

  async validateApprovalToken(token) {
    const payload = this.verifyApprovalToken(token);
    const row = await RequestModel.findById(
      payload.request_id,
      payload.company_id,
    );

    if (!row) {
      throw new AppError(
        "ไม่พบคำขอที่ต้องการอนุมัติ",
        404,
        "REQUEST_NOT_FOUND",
      );
    }

    const { flow, requestData } = await this.ensureWorkflowExists(row);
    const currentStep = this.findCurrentStep(flow);
    const step = this.getStepByToken(flow, payload);

    this.ensureRequestStillPending(row);
    this.ensureTargetStepCanApprove({
      currentStep,
      targetStep: step,
      requestId: row.id,
    });

    return {
      valid: true,
      request_id: row.id,
      request_type: row.request_type,
      request_type_label: this.buildRequestTypeLabel(row.request_type),
      employee_name: row.employee_name,
      employee_code: row.employee_code,
      target_date:
        row.target_date || requestData?.date || requestData?.work_date,
      current_step: {
        order: currentStep.order,
        role: currentStep.role,
        role_label: currentStep.role_label,
        stage_label: currentStep.stage_label,
      },
      expires_at: payload?.exp
        ? new Date(payload.exp * 1000).toISOString()
        : null,
    };
  }

  ensureRequestStillPending(row) {
    if (row.status !== "pending") {
      throw new AppError(
        "คำขอนี้ถูกอนุมัติหรือปิดการทำงานแล้ว",
        409,
        "REQUEST_ALREADY_PROCESSED",
        {
          request_id: row.id,
          status: row.status,
          approved_at: row.approved_at,
        },
      );
    }
  }

  ensureTargetStepCanApprove({ currentStep, targetStep, requestId }) {
    if (!targetStep) {
      throw new AppError(
        "ลิงก์อนุมัติไม่ตรงกับลำดับการอนุมัติปัจจุบัน",
        409,
        "APPROVAL_STEP_NOT_FOUND",
      );
    }

    if (targetStep.status === "approved") {
      throw new AppError(
        "คุณได้อนุมัติคำขอนี้ไปแล้ว",
        409,
        "APPROVAL_ALREADY_DONE",
        {
          request_id: requestId,
          approved_at: targetStep.approved_at,
          stage_label: targetStep.stage_label,
        },
      );
    }

    if (!currentStep || currentStep.order !== targetStep.order) {
      throw new AppError(
        "คำขอนี้เลื่อนไปขั้นตอนถัดไปแล้ว",
        409,
        "APPROVAL_STEP_EXPIRED",
      );
    }

    if (targetStep.status !== "pending") {
      throw new AppError(
        "ลำดับนี้ถูกดำเนินการไปแล้ว",
        409,
        "APPROVAL_ALREADY_DONE",
        {
          request_id: requestId,
          stage_label: targetStep.stage_label,
          step_status: targetStep.status,
        },
      );
    }
  }

  buildApprovedFlow(flow, targetStepOrder, nowIso) {
    const nextFlow = {
      ...flow,
      steps: flow.steps.map((step) =>
        step.order === targetStepOrder
          ? {
              ...step,
              status: "approved",
              approved_at: nowIso,
            }
          : step,
      ),
      updated_at: nowIso,
    };

    const nextStep = nextFlow.steps.find(
      (step) => step.order === targetStepOrder + 1,
    );

    if (nextStep) {
      nextFlow.current_step_order = nextStep.order;
    } else {
      nextFlow.current_step_order = null;
      nextFlow.completed_at = nowIso;
    }

    return {
      nextFlow,
      nextStep,
    };
  }

  async approveByToken(token) {
    // NOSONAR - orchestration with transaction and step safety checks
    const payload = this.verifyApprovalToken(token);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const row = await RequestModel.findByIdForUpdate(
        payload.request_id,
        payload.company_id,
        connection,
      );

      if (!row) {
        throw new AppError(
          "ไม่พบคำขอที่ต้องการอนุมัติ",
          404,
          "REQUEST_NOT_FOUND",
        );
      }

      this.ensureRequestStillPending(row);

      const { flow, requestData } = await this.ensureWorkflowExists(row, {
        connection,
      });

      const currentStep = this.findCurrentStep(flow);
      const targetStep = this.getStepByToken(flow, payload);
      this.ensureTargetStepCanApprove({
        currentStep,
        targetStep,
        requestId: row.id,
      });

      const nowIso = new Date().toISOString();
      const { nextFlow, nextStep } = this.buildApprovedFlow(
        flow,
        targetStep.order,
        nowIso,
      );

      const nextRequestData = this.attachApprovalFlow(requestData, nextFlow);
      const nextStatus = nextStep ? "pending" : "approved";
      const finalApproverId = nextStep
        ? row.approver_id || null
        : targetStep.user_id;
      const finalApprovedAt = nextStep ? row.approved_at || null : nowIso;

      await RequestModel.updateWorkflowState(
        row.id,
        row.company_id,
        {
          requestData: nextRequestData,
          status: nextStatus,
          approverId: finalApproverId,
          approvedAt: finalApprovedAt,
          rejectedReason: row.rejected_reason || null,
        },
        connection,
      );

      await connection.commit();
      connection.release();

      if (nextStep) {
        const refreshed = await RequestModel.findById(row.id, row.company_id);
        if (refreshed) {
          const refreshedData =
            this.normalizeRequestData(refreshed.request_data) || {};
          const refreshedFlow = this.extractApprovalFlow(refreshedData);
          if (refreshedFlow) {
            await this.notifyCurrentStepApprover(
              refreshed,
              refreshedFlow,
              refreshedData,
            );
          }
        }
      }

      return {
        request_id: row.id,
        approved: !nextStep,
        next_step: nextStep
          ? {
              order: nextStep.order,
              role: nextStep.role,
              role_label: nextStep.role_label,
              stage_label: nextStep.stage_label,
            }
          : null,
        approved_at: nextStep ? null : nowIso,
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  async rejectByToken(token, rejectedReason) {
    const payload = this.verifyApprovalToken(token);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const row = await RequestModel.findByIdForUpdate(
        payload.request_id,
        payload.company_id,
        connection,
      );

      if (!row) {
        throw new AppError(
          "ไม่พบคำขอที่ต้องการอนุมัติ",
          404,
          "REQUEST_NOT_FOUND",
        );
      }

      this.ensureRequestStillPending(row);

      const { flow, requestData } = await this.ensureWorkflowExists(row, {
        connection,
      });

      const currentStep = this.findCurrentStep(flow);
      const targetStep = this.getStepByToken(flow, payload);

      this.ensureTargetStepCanApprove({
        currentStep,
        targetStep,
        requestId: row.id,
      });

      const nowIso = new Date().toISOString();
      const nextFlow = {
        ...flow,
        steps: flow.steps.map((step) =>
          step.order === targetStep.order
            ? {
                ...step,
                status: "rejected",
                rejected_at: nowIso,
              }
            : step,
        ),
        current_step_order: null,
        updated_at: nowIso,
        completed_at: nowIso,
      };

      const nextRequestData = this.attachApprovalFlow(requestData, nextFlow);
      const finalRejectedReason =
        String(rejectedReason || "").trim() ||
        `ปฏิเสธโดย ${targetStep.stage_label}`;

      await RequestModel.updateWorkflowState(
        row.id,
        row.company_id,
        {
          requestData: nextRequestData,
          status: "rejected",
          approverId: targetStep.user_id,
          approvedAt: nowIso,
          rejectedReason: finalRejectedReason,
        },
        connection,
      );

      await connection.commit();
      connection.release();

      return {
        request_id: row.id,
        rejected: true,
        rejected_at: nowIso,
        rejected_reason: finalRejectedReason,
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  }
}

module.exports = new RequestService();
