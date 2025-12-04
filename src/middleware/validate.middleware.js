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

module.exports = {
  validate,
  authSchemas,
  companySchemas,
  departmentSchemas,
};
