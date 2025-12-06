/**
 * /src/api/middleware/validate.middleware.js
 *
 * Validation Middleware using Joi
 * ตรวจสอบความถูกต้องของ request data
 */

const Joi = require("joi");

/**
 * สร้าง Validation Middleware จาก Joi Schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Property ที่จะ validate ('body', 'query', 'params')
 */
const validate = (schema, property = "body") => {
  return (req, res, next) => {
    // ดำเนินการ validate
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // แสดง error ทั้งหมด ไม่หยุดที่ error แรก
      stripUnknown: true, // ลบ field ที่ไม่ได้กำหนดใน schema
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message.replaceAll('"', ""),
      }));

      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
    }

    // แทนที่ข้อมูลเดิมด้วยข้อมูลที่ผ่านการ validate แล้ว
    req[property] = value;
    next();
  };
};

// ========================================
// Auth Validation Schemas
// ========================================
const authSchemas = {
  login: Joi.object({
    email: Joi.string().email().max(255).required(), // อีเมลต้องถูกต้องตามรูปแบบ
    password: Joi.string().min(6).max(128).required(), // รหัสผ่านอย่างน้อย 6 ตัวอักษร
  }),

  register: Joi.object({
    email: Joi.string().email().max(255).required(), // อีเมลต้องถูกต้องตามรูปแบบ
    password: Joi.string().min(6).max(128).required(), // รหัสผ่านอย่างน้อย 6 ตัวอักษร
    role: Joi.string().valid("admin", "user").required(), // กำหนดบทบาทผู้ใช้
  }),

  refreshToken: Joi.object({
    token: Joi.string().required(), // โทเค็นต้องมีค่า
  }),
};

// ========================================
// Company Validation Schemas
// ========================================

const companySchemas = {
  get: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(255),
    branch: Joi.string().max(5).allow("", null),
    email: Joi.string().email().max(255).allow("", null),
    phoneNumber: Joi.string().max(255).allow("", null),
    contactPerson: Joi.string().max(255).allow("", null),
    address: Joi.string().max(255).allow("", null),
    province: Joi.string().max(255).allow("", null),
    district: Joi.string().max(255).allow("", null),
    sub_district: Joi.string().max(255).allow("", null),
    postal_code: Joi.string().max(255).allow("", null),
    hr_name: Joi.string().max(255).allow("", null),
    hr_email: Joi.string().email().max(255),
    report_date: Joi.number().integer().min(1).max(31),
  }).min(1), // ต้องมีอย่างน้อย 1 field
};

// ========================================
// Department Validation Schemas
// ========================================

const departmentSchemas = {
  get: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),

  create: Joi.object({
    departmentName: Joi.string().min(2).max(255).required(),
    headDep_email: Joi.string().email().max(255).allow("", null),
    headDep_name: Joi.string().max(255).allow("", null),
    headDep_tel: Joi.string().max(255).allow("", null),
  }),

  getById: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),

  update: Joi.object({
    departmentName: Joi.string().min(2).max(255),
    headDep_email: Joi.string().email().max(255).allow("", null),
    headDep_name: Joi.string().max(255).allow("", null),
    headDep_tel: Joi.string().max(255).allow("", null),
  }).min(1),

  delete: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
};

// ========================================
// Employee Validation Schemas
// ========================================
const employeeSchemas = {
  get: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    companyId: Joi.number().integer().positive().optional(),
    departmentId: Joi.number().integer().positive().optional(),
    q: Joi.string().max(255).allow("", null).optional(), // search query
  }),

  create: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    ID_or_Passport_Number: Joi.string()
      .pattern(/^\d{1,13}$/)
      .max(13)
      .allow("", null),
    companyId: Joi.number().integer().positive().required(),
    lineUserId: Joi.string().max(255).allow("", null),
    start_date: Joi.date().iso().allow("", null),
    departmentId: Joi.number().integer().positive().allow(null),
    dayOff: Joi.string().max(255).allow("", null),
    resign_date: Joi.date().iso().allow("", null),
  }),

  getEmployeeById: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(255),
    ID_or_Passport_Number: Joi.string()
      .pattern(/^\d{1,13}$/)
      .max(13)
      .allow("", null),
    companyId: Joi.number().integer().positive(),
    lineUserId: Joi.string().max(255).allow("", null),
    start_date: Joi.date().iso().allow("", null),
    departmentId: Joi.number().integer().positive().allow(null),
    dayOff: Joi.string().max(255).allow("", null),
    resign_date: Joi.date().iso().allow("", null),
  }).min(1),

  resign: Joi.object({
    resign_date: Joi.alternatives()
      .try(
        Joi.date().iso(),
        Joi.string()
          .pattern(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
          .custom((value, helpers) => {
            // parse dd/MM/yyyy and convert Buddhist year (if present) to Gregorian
            const parts = value.split("/").map((p) => Number.parseInt(p, 10));
            const [d, m, y] = parts;
            if (!d || !m || !y) return helpers.error("any.invalid");
            let year = y;
            // if year looks like Thai Buddhist year (>= 2400), convert to AD
            if (year >= 2400) {
              year = year - 543;
            }
            const iso = `${year.toString().padStart(4, "0")}-${String(
              m
            ).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dt = new Date(iso);
            if (Number.isNaN(dt.getTime())) return helpers.error("any.invalid");
            return dt;
          })
      )
      .required(),
  }),
};

// ========================================
// Attendance Validation Schemas
// ========================================
const attendanceSchemas = {
  // Check-in validation
  checkIn: Joi.object({
    location: Joi.string().max(500).allow("", null), // พิกัด GPS หรือชื่อสถานที่
    note: Joi.string().max(500).allow("", null), // หมายเหตุ
  }),

  // Check-out validation
  checkOut: Joi.object({
    location: Joi.string().max(500).allow("", null),
    note: Joi.string().max(500).allow("", null),
  }),

  // Break start validation
  breakStart: Joi.object({
    note: Joi.string().max(255).allow("", null),
  }),

  // Break end validation
  breakEnd: Joi.object({
    note: Joi.string().max(255).allow("", null),
  }),

  // Get history validation (query params)
  getHistory: Joi.object({
    startDate: Joi.date().iso().allow("", null),
    endDate: Joi.date().iso().allow("", null),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),

  // Get summary validation (query params)
  getSummary: Joi.object({
    month: Joi.number().integer().min(1).max(12).allow(null),
    year: Joi.number().integer().min(2000).max(2100).allow(null),
  }),
};

// ========================================
// Devices Validation Schemas
// ========================================
const devicesSchemas = {
  // Create device validation
  createDevice: Joi.object({
    name: Joi.string().min(1).max(255).required(), // ชื่ออุปกรณ์
    locationURL: Joi.string().uri().max(255).allow("", null), // URL สถานที่ (Google Maps)
    hwid: Joi.string().min(1).max(45).required(), // Hardware ID
    passcode: Joi.string().min(1).max(45).required(), // รหัสผ่านอุปกรณ์
    employeeIds: Joi.array()
      .items(Joi.number().integer().positive())
      .default([]), // รายการพนักงานที่ผูกกับอุปกรณ์
  }),

  // Update device validation
  updateDevice: Joi.object({
    name: Joi.string().min(1).max(255),
    locationURL: Joi.string().uri().max(255).allow("", null),
    hwid: Joi.string().min(1).max(45),
    passcode: Joi.string().min(1).max(45),
    employeeIds: Joi.array().items(Joi.number().integer().positive()),
  }).min(1), // ต้องมีอย่างน้อย 1 field

  // Sync device validation (สำหรับเครื่อง Time Attendance)
  syncDevice: Joi.object({
    hwid: Joi.string().min(1).max(45).required(), // Hardware ID
    passcode: Joi.string().min(1).max(45).required(), // รหัสผ่านอุปกรณ์
  }),
};

// ========================================
// Overtime Validation Schemas
// ========================================
const overtimeSchemas = {
  create: Joi.object({
    overTimeName: Joi.string().min(2).max(255).required(),
    ot_start_time: Joi.string()
      .pattern(/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
      .required()
      .messages({
        "string.pattern.base":
          "ot_start_time must be in HH:mm or HH:mm:ss format",
      }),
    ot_end_time: Joi.string()
      .pattern(/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
      .required()
      .messages({
        "string.pattern.base":
          "ot_end_time must be in HH:mm or HH:mm:ss format",
      }),
    employeeId: Joi.alternatives()
      .try(
        Joi.string().required(),
        Joi.array().items(Joi.number().integer()).required()
      )
      .required()
      .custom((value) => {
        // แปลงเป็น JSON string ถ้าเป็น array
        if (Array.isArray(value)) {
          return JSON.stringify(value);
        }
        return value;
      }),
  }),
};

// ========================================
// Shifts Validation Schemas
// ========================================
const timePattern = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const shiftsSchemas = {
  create: Joi.object({
    shift_name: Joi.string().min(2).max(255).required(),
    free_time: Joi.number().integer().min(0).default(0),
    is_shift: Joi.number().integer().valid(0, 1).default(1),
    is_night_shift: Joi.number().integer().valid(0, 1).default(0),
    is_specific: Joi.number().integer().valid(0, 1).default(0),
    month: Joi.number().integer().min(1).max(12).allow(null),
    date: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.number().integer()))
      .allow(null),
    start_time: Joi.string().pattern(timePattern).allow(null),
    end_time: Joi.string().pattern(timePattern).allow(null),
    is_break: Joi.number().integer().valid(0, 1).default(1),
    break_start_time: Joi.string().pattern(timePattern).allow(null),
    break_end_time: Joi.string().pattern(timePattern).allow(null),
    employeeId: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.number().integer()))
      .allow(null),
  }),

  update: Joi.object({
    shift_name: Joi.string().min(2).max(255),
    free_time: Joi.number().integer().min(0),
    is_shift: Joi.number().integer().valid(0, 1),
    is_night_shift: Joi.number().integer().valid(0, 1),
    is_specific: Joi.number().integer().valid(0, 1),
    month: Joi.number().integer().min(1).max(12).allow(null),
    date: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.number().integer()))
      .allow(null),
    start_time: Joi.string().pattern(timePattern).allow(null),
    end_time: Joi.string().pattern(timePattern).allow(null),
    is_break: Joi.number().integer().valid(0, 1),
    break_start_time: Joi.string().pattern(timePattern).allow(null),
    break_end_time: Joi.string().pattern(timePattern).allow(null),
    employeeId: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.number().integer()))
      .allow(null),
  }).min(1),

  assign: Joi.object({
    shiftId: Joi.number().integer().positive().required(),
    employeeIds: Joi.alternatives()
      .try(
        Joi.string().required(),
        Joi.array().items(Joi.number().integer().positive()).min(1).required()
      )
      .required(),
  }),
};

module.exports = {
  validate,
  authSchemas,
  companySchemas,
  departmentSchemas,
  employeeSchemas,
  attendanceSchemas,
  devicesSchemas,
  overtimeSchemas,
  shiftsSchemas,
};
