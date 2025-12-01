/**
 * /api/models/index.js
 *
 * Central Model Registry
 * รวบรวมและ Export Models ทั้งหมด พร้อมกำหนด Associations
 *
 * การใช้งาน:
 *   const { Company, Employee, Department } = require('./models');
 *   const employee = await Employee.findWithDepartment(1);
 */

// ========================================
// Import Models
// ========================================

// Base Model
const BaseModel = require("./base.model");

// Organization Domain
const Company = require("./company.model");
const Department = require("./department.model");

// People Domain
const Employee = require("./employee.model");

// Time Configuration Domain
const WorkingTime = require("./workingTime.model");
const Overtime = require("./overtime.model");

// Operation & Logging Domain
const TimestampRecord = require("./timestamp.model");
const ForgetTimestampRequest = require("./request.model");

// Hardware Domain
const Device = require("./device.model");

// ========================================
// Date Serialization Helpers
// ========================================

/** -----------------------------------------------------------------------
 * แปลง Date เป็น ISO String (UTC)
 */
const toISODate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split("T")[0];
};

/** -----------------------------------------------------------------------
 * แปลง Time เป็น HH:MM:SS format
 */
const toTimeString = (time) => {
  if (!time) return null;
  if (typeof time === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    return time.length === 5 ? `${time}:00` : time;
  }
  const d = new Date(time);
  return d.toTimeString().split(" ")[0];
};

/** -----------------------------------------------------------------------
 * แปลง DateTime เป็น ISO String (UTC)
 */
const toISODateTime = (datetime) => {
  if (!datetime) return null;
  return new Date(datetime).toISOString();
};

/** -----------------------------------------------------------------------
 * แปลง ISO String เป็น Local Date (ตาม Timezone ที่กำหนด, default Asia/Bangkok)
 */
const toLocalDate = (isoString, timezone = "Asia/Bangkok") => {
  if (!isoString) return null;
  return new Date(
    new Date(isoString).toLocaleString("en-US", { timeZone: timezone })
  );
};

// ========================================
// Model Associations Reference - ความสัมพันธ์ระหว่างโมเดล
// ========================================

/**
 * Relationships Map (สำหรับ Reference)
 *
 * Company (1) ──────┬──> (N) Department
 *                   ├──> (N) Employee
 *                   ├──> (N) WorkingTime
 *                   ├──> (N) Overtime
 *                   ├──> (N) Device
 *                   ├──> (N) TimestampRecord
 *                   └──> (N) ForgetTimestampRequest
 *
 * Department (1) ──> (N) Employee
 *
 * Employee (1) ──────┬──> (N) TimestampRecord
 *                    └──> (N) ForgetTimestampRequest
 *
 * WorkingTime (1) ──> (N) TimestampRecord
 *
 * Overtime (1) ──> (N) TimestampRecord
 */

// ========================================
// Utility Functions
// ========================================

/** -----------------------------------------------------------------------
 * ดึงข้อมูลพนักงานพร้อมข้อมูลที่เกี่ยวข้องทั้งหมด
 */
const getEmployeeFullProfile = async (employeeId) => {
  const employee = await Employee.findWithWorkingTime(employeeId);
  if (!employee) return null;

  // ดึง OT rules ที่พนักงานมีสิทธิ์
  const overtimeRules = await Overtime.findByEmployee(
    employee.company_id,
    employeeId
  );

  // ดึง Devices ที่พนักงานมีสิทธิ์ใช้
  const devices = await Device.findByCompany(employee.company_id);
  const accessibleDevices = devices.filter((device) => {
    const employeeIds = Device.parseEmployeeIds(device.employeeId);
    return employeeIds.length === 0 || employeeIds.includes(employeeId);
  });

  return {
    ...employee,
    overtime_rules: overtimeRules,
    accessible_devices: accessibleDevices.map((d) => ({
      id: d.id,
      device_name: d.device_name,
      device_type: d.device_type,
      location_name: d.location_name,
    })),
  };
};

/** -----------------------------------------------------------------------
 * ดึงสรุปข้อมูลบริษัท
 */
const getCompanySummary = async (companyId) => {
  const company = await Company.findWithEmployeeStats(companyId);
  if (!company) return null;

  const [departments, pendingRequests, todayStats] = await Promise.all([
    Department.findWithEmployeeCount(companyId),
    ForgetTimestampRequest.countPending(companyId),
    TimestampRecord.getTodayCompanyStats(companyId),
  ]);

  return {
    ...company,
    departments,
    pending_requests: pendingRequests,
    today_attendance: todayStats,
  };
};

// ========================================
// Export Models & Utilities - การส่งออกโมเดลและยูทิลิตี้
// ========================================

module.exports = {
  // Base Model - โมเดลฐาน
  BaseModel,

  // Organization Domain - โดเมนองค์กร
  Company,
  Department,

  // People Domain - โดเมนบุคคล
  Employee,

  // Time Configuration Domain - โดเมนการตั้งค่าเวลา
  WorkingTime,
  Overtime,

  // Operation & Logging Domain - โดเมนการปฏิบัติการและการบันทึก
  TimestampRecord,
  ForgetTimestampRequest,

  // Hardware Domain - โดเมนฮาร์ดแวร์
  Device,

  // Date/Time Helpers - ตัวช่วยจัดการวันที่/เวลา
  dateHelpers: {
    toISODate,
    toTimeString,
    toISODateTime,
    toLocalDate,
  },

  // Utility Functions - ฟังก์ชันอรรถประโยชน์
  utils: {
    getEmployeeFullProfile,
    getCompanySummary,
  },

  // Enums - ตัวแปรค่าคงที่
  enums: {
    RequestStatus: ForgetTimestampRequest.STATUS,
    RequestType: ForgetTimestampRequest.TYPE,
    DeviceType: Device.TYPE,
    DeviceStatus: Device.STATUS,
  },
};
