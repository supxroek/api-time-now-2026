/**
 * /src/modules/employees/employee.service.js
 *
 * Employees Service
 * ชั้นบริการสำหรับการจัดการข้อมูลพนักงาน
 */

// import models and helpers
const pool = require("../../config/database");
const EmployeeModel = require("./employee.model");
const DateUtil = require("../../utilities/date");
const XLSX = require("xlsx");

// ==================== Constants ====================
// คอลัมน์ที่จำเป็นต้องมีในการ import
const REQUIRED_COLUMNS = ["name"];
// คอลัมน์ที่รองรับทั้งหมด (mapping ชื่อคอลัมน์ที่เป็นไปได้ -> ชื่อฟิลด์มาตรฐาน)
const COLUMN_MAPPINGS = {
  // name variations
  name: "name",
  ชื่อ: "name",
  "ชื่อ-นามสกุล": "name",
  ชื่อพนักงาน: "name",
  employee_name: "name",
  employeename: "name",
  fullname: "name",
  full_name: "name",

  // ID/Passport variations
  id_or_passport_number: "ID_or_Passport_Number",
  id_or_passport: "ID_or_Passport_Number",
  idorpassport: "ID_or_Passport_Number",
  passport: "ID_or_Passport_Number",
  passport_number: "ID_or_Passport_Number",
  id_card: "ID_or_Passport_Number",
  idcard: "ID_or_Passport_Number",
  บัตรประชาชน: "ID_or_Passport_Number",
  เลขบัตรประชาชน: "ID_or_Passport_Number",
  หนังสือเดินทาง: "ID_or_Passport_Number",

  // lineUserId variations
  lineuserid: "lineUserId",
  line_user_id: "lineUserId",
  line_id: "lineUserId",
  lineid: "lineUserId",
  line: "lineUserId",
  ไลน์: "lineUserId",

  // start_date variations
  start_date: "start_date",
  startdate: "start_date",
  วันเริ่มงาน: "start_date",
  วันที่เริ่มงาน: "start_date",
  hire_date: "start_date",
  hiredate: "start_date",

  // departmentId variations
  departmentid: "departmentId",
  department_id: "departmentId",
  department: "departmentId",
  แผนก: "departmentId",
  รหัสแผนก: "departmentId",

  // dayOff variations
  dayoff: "dayOff",
  day_off: "dayOff",
  วันหยุด: "dayOff",
  วันหยุดประจำสัปดาห์: "dayOff",

  // companyId variations (ปกติจะไม่ต้องระบุ เพราะดึงจาก user)
  companyid: "companyId",
  company_id: "companyId",
  company: "companyId",
  บริษัท: "companyId",
  รหัสบริษัท: "companyId",
};

// ฟิลด์มาตรฐานทั้งหมดที่รองรับ
const STANDARD_FIELDS = new Set([
  "name",
  "ID_or_Passport_Number",
  "lineUserId",
  "start_date",
  "departmentId",
  "dayOff",
  "companyId",
]);

// Service Class
class EmployeeService {
  // ดึงรายการพนักงานทั้งหมดของบริษัททีผู้ใช้สังกัด
  async getEmployees(companyId) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("companyId is required");
    }

    // ดึงพนักงาน
    const employees = await EmployeeModel.findAllByCompanyId(companyId);
    // ตรวจสอบคอลัมน์ resign_date ว่าเป็น NULL หรือไม่ (พนักงานที่ยังไม่ลาออก)
    // หากไม่เป็น null ให้ตรวจสอบว่าวันที่ลาออกต้องมากกว่าวันที่ปัจจุบัน (resign_date > current date)
    const currentDate = DateUtil.now();
    // กรองเอาเฉพาะพนักงานที่ยังไม่ลาออก
    const filteredEmployees = employees.filter((employee) => {
      if (!employee.resign_date) {
        return true; // ยังไม่ลาออก
      }
      // ใช้ DateUtil.isAfter() เพื่อเปรียบเทียบวันที่
      return DateUtil.isAfter(employee.resign_date, currentDate); // ยังไม่ถึงวันลาออก
    });

    return filteredEmployees;
  }

  // สร้างพนักงานใหม่สำหรับบริษัทที่ระบุ
  async createEmployee(companyId, employeeData) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบ companyId
      if (!companyId || !employeeData) {
        throw new Error("companyId and employeeData are required");
      }
      // ตรวจสอบ ID_or_Passport_Number และ lineUserId ไม่ให้ซ้ำกันภายในบริษัท
      const existingEmployees = await EmployeeModel.findAllByCompanyId(
        companyId
      );
      const isDuplicate = existingEmployees.some(
        (emp) =>
          emp.ID_or_Passport_Number === employeeData.ID_or_Passport_Number ||
          emp.lineUserId === employeeData.lineUserId
      );
      if (isDuplicate) {
        throw new Error(
          `Employee with ID_or_Passport_Number:${employeeData.ID_or_Passport_Number} or lineUserId:${employeeData.lineUserId} already exists within the company`
        );
      }

      // กำหนดค่าเริ่มต้นหากไม่ได้ระบุ สร้างเป็น Object
      const defaultEmployeeData = {
        name: null,
        ID_or_Passport_Number: null,
        lineUserId: null,
        start_date: null,
        departmentId: null,
        dayOff: null,
      };
      employeeData = { ...defaultEmployeeData, ...employeeData };

      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      connection.release();
      // สร้างพนักงานใหม่
      return await EmployeeModel.create(companyId, employeeData);
    } catch (error) {
      // rollback transaction - กรณีล้มเหลว: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  // ดึงข้อมูลพนักงานตาม ID สำหรับบริษัทที่ระบุ
  async getEmployeeById(companyId, employeeId) {
    if (!companyId) {
      throw new Error("companyId is required");
    }
    if (!employeeId) {
      throw new Error("employeeId is required");
    }

    // ดึงพนักงาน
    const employee = await EmployeeModel.findById(companyId, employeeId);
    // ตรวจสอบว่ามีข้อมูลพนักงานหรือไม่
    if (!employee) {
      throw new Error(`Employee with ID:${employeeId} not found`);
    }

    return employee;
  }

  // อัปเดตข้อมูลพนักงานตาม ID สำหรับบริษัทที่ระบุ
  async updateEmployee(companyId, employeeId, updateData) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบ companyId
      if (!companyId) {
        throw new Error("companyId is required");
      }
      if (!employeeId) {
        throw new Error("employeeId is required");
      }

      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      connection.release();
      // อัปเดตพนักงาน
      return await EmployeeModel.updateByIdAndCompanyId(
        companyId,
        employeeId,
        updateData
      );
    } catch (error) {
      // rollback transaction - กรณีล้มเหลว: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  // เมื่อพนักงานลาออก อัปเดตวันที่ลาออกตาม ID สำหรับบริษัทที่ระบุ
  async resignEmployee(companyId, employeeId, resignDate) {
    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // ตรวจสอบ companyId
      if (!companyId) {
        throw new Error("companyId is required");
      }
      if (!employeeId) {
        throw new Error("employeeId is required");
      }
      if (!resignDate) {
        throw new Error("resignDate is required");
      }

      // แปลง resignDate เป็นวัตถุ Date
      const parsedResignDate = DateUtil.parseISOToDate(resignDate);
      // ตรวจสอบให้แน่ใจว่า resignDate ไม่อยู่ก่อน start_date ของพนักงาน
      const employee = await EmployeeModel.findById(companyId, employeeId);
      if (!employee) {
        throw new Error(`Employee with ID:${employeeId} not found`);
      }
      // ใช้ DateUtil.isBefore() เพื่อเปรียบเทียบวันที่
      if (
        employee.start_date &&
        DateUtil.isBefore(parsedResignDate, employee.start_date)
      ) {
        throw new Error("resignDate cannot be earlier than start_date");
      }

      resignDate = parsedResignDate;

      // commit transaction - กรณีสำเร็จ:บันทึกข้อมูลลงฐานข้อมูล
      await connection.commit();
      connection.release();
      // อัพเดตพนักงาน
      return await EmployeeModel.resignByIdAndCompanyId(
        companyId,
        employeeId,
        resignDate
      );
    } catch (error) {
      // rollback transaction - กรณีล้มเหลว: ยกเลิกการเปลี่ยนแปลงทั้งหมด
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  // ฟังก์ชันพิเศษ: นำเข้าข้อมูลพนักงานจำนวนมาก (Bulk Import)
  // รองรับทั้ง JSON body และไฟล์ (XLS/XLSX/CSV)
  async importEmployees({ companyId, file, body }) {
    // ตรวจสอบ companyId
    if (!companyId) {
      throw new Error("companyId is required");
    }

    // ขั้นตอนที่ 1: ตรวจสอบประเภทข้อมูลและแปลงเป็น array
    let rawData = [];
    let inputType;
    let columnValidation = null;

    if (file?.buffer) {
      // ตรวจสอบประเภทไฟล์จาก mimetype หรือ extension
      const isCsv = this._isCsvFile(file);

      if (isCsv) {
        // กรณีเป็นไฟล์ CSV
        inputType = "csv";
        const parseResult = this._parseCsvFile(file.buffer);
        rawData = parseResult.data;
        columnValidation = parseResult.columnValidation;
      } else {
        // กรณีเป็นไฟล์ Excel (XLS/XLSX)
        inputType = "excel";
        const parseResult = this._parseExcelFile(file.buffer);
        rawData = parseResult.data;
        columnValidation = parseResult.columnValidation;
      }

      // ถ้ามีปัญหากับชื่อคอลัมน์ ให้แจ้งเตือน
      if (columnValidation && !columnValidation.isValid) {
        return {
          success: false,
          inputType,
          message: "Column validation failed",
          columnValidation,
          totalRecords: 0,
          successCount: 0,
          failedCount: 0,
          skippedRecords: [],
        };
      }
    } else if (body) {
      // กรณีเป็น JSON body
      inputType = "json";
      if (Array.isArray(body)) {
        rawData = body;
      } else if (typeof body === "object" && body !== null) {
        // ถ้าส่งมาเป็น object เดียว ให้แปลงเป็น array
        rawData = [body];
      } else {
        throw new Error(
          "Invalid input format. Expected JSON array or Excel file."
        );
      }
    } else {
      throw new Error(
        "No input data provided. Please send JSON body or upload a file (XLS/XLSX/CSV)."
      );
    }

    // ขั้นตอนที่ 2: Normalize ข้อมูลให้อยู่ในรูปแบบมาตรฐาน
    const normalizedData = this._normalizeEmployeesData(rawData, companyId);

    // ขั้นตอนที่ 3: ดำเนินการ import
    const result = await this._executeImport(companyId, normalizedData);

    return {
      success: true,
      inputType,
      message: "Import completed",
      columnValidation,
      ...result,
    };
  }

  // ==================== Private Helper Methods ====================

  // Private Helper Methods: ตรวจสอบว่าไฟล์เป็น CSV หรือไม่
  _isCsvFile(file) {
    const csvMimes = ["text/csv", "application/csv", "text/plain"];
    const fileExtension = file.originalname
      ?.toLowerCase()
      ?.substring(file.originalname.lastIndexOf("."));

    return csvMimes.includes(file.mimetype) || fileExtension === ".csv";
  }

  // Private Helper Methods: แปลงไฟล์ CSV เป็น array ของ objects
  _parseCsvFile(buffer) {
    // แปลง buffer เป็น string
    const csvString = buffer.toString("utf-8");

    // แยกบรรทัดและกรองบรรทัดว่าง
    const lines = csvString
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return {
        data: [],
        columnValidation: {
          isValid: false,
          message: "CSV file is empty",
          foundColumns: [],
          missingRequired: REQUIRED_COLUMNS,
          suggestions: [],
        },
      };
    }

    // บรรทัดแรกเป็น header
    const headerLine = lines[0];
    const headers = this._parseCsvLine(headerLine);

    if (lines.length === 1) {
      return {
        data: [],
        columnValidation: {
          isValid: false,
          message: "CSV file has no data rows (only header)",
          foundColumns: headers,
          missingRequired: REQUIRED_COLUMNS,
          suggestions: [],
        },
      };
    }

    // ตรวจสอบชื่อคอลัมน์
    const columnValidation = this._validateAndMapColumns(headers);

    if (!columnValidation.isValid) {
      return { data: [], columnValidation };
    }

    // แปลงข้อมูลแต่ละบรรทัด (delegate row mapping to helper to reduce complexity)
    const rawData = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCsvLine(lines[i]);
      const row = this._mapCsvRow(headers, values);
      rawData.push(row);
    }

    return { data: rawData, columnValidation };
  }

  // Private Helper Methods: วิเคราะห์บรรทัด CSV เป็น array ของค่า (รองรับการมีเครื่องหมายคำพูดล้อมรอบและการ escape)
  _parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    let skipNext = false;

    for (let i = 0; i < line.length; i++) {
      if (skipNext) {
        // ข้ามตัวอักษรนี้เพราะถูกใช้เป็นส่วนหนึ่งของเครื่องหมายคำพูดที่ escape แล้ว
        skipNext = false;
        continue;
      }

      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          // Escaped quote: เพิ่มเครื่องหมายคำพูดเดียวและข้ามตัวอักษรถัดไป
          current += '"';
          skipNext = true;
        } else if (char === '"') {
          // สิ้นสุดค่าที่มีเครื่องหมายคำพูดล้อมรอบ
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        // เริ่มต้นค่าที่มีเครื่องหมายคำพูดล้อมรอบ
        inQuotes = true;
      } else if (char === ",") {
        // สิ้นสุดฟิลด์
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    // เพิ่มฟิลด์สุดท้าย
    result.push(current.trim());

    return result;
  }

  // Private Helper Methods: แปลง headers+values เป็น object ของฟิลด์มาตรฐาน (แยกออกเพื่อลดความซับซ้อนของ parent)
  _mapCsvRow(headers, values) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j] === undefined ? null : values[j];

      // แปลงชื่อคอลัมน์เป็นฟิลด์มาตรฐาน
      const normalizedCol = header.toLowerCase().trim();
      const standardField = COLUMN_MAPPINGS[normalizedCol];

      if (standardField) {
        // แปลงค่าว่างเป็น null
        row[standardField] = value === "" ? null : value;
      }
    }
    return row;
  }

  // Private Helper Methods: แปลงไฟล์ Excel เป็น array ของ objects
  _parseExcelFile(buffer) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // แปลงเป็น JSON (header row เป็น keys)
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    if (rawData.length === 0) {
      return {
        data: [],
        columnValidation: {
          isValid: false,
          message: "Excel file is empty or has no data rows",
          foundColumns: [],
          missingRequired: REQUIRED_COLUMNS,
          suggestions: [],
        },
      };
    }

    // ตรวจสอบชื่อคอลัมน์
    const originalColumns = Object.keys(rawData[0] || {});
    const columnValidation = this._validateAndMapColumns(originalColumns);

    if (!columnValidation.isValid) {
      return { data: [], columnValidation };
    }

    // แปลงข้อมูลโดยใช้ column mapping
    const mappedData = rawData.map((row) => {
      const mappedRow = {};
      for (const [originalCol, value] of Object.entries(row)) {
        const normalizedCol = originalCol.toLowerCase().trim();
        const standardField = COLUMN_MAPPINGS[normalizedCol];
        if (standardField) {
          mappedRow[standardField] = value;
        }
      }
      return mappedRow;
    });

    return { data: mappedData, columnValidation };
  }

  // Private Helper Methods: ตรวจสอบและ map ชื่อคอลัมน์
  _validateAndMapColumns(columns) {
    const normalizedColumns = columns.map((col) => col.toLowerCase().trim());
    const mappedFields = new Set();
    const suggestions = [];

    // หา field ที่ map ได้
    for (const col of normalizedColumns) {
      const mappedField = COLUMN_MAPPINGS[col];
      if (mappedField) {
        mappedFields.add(mappedField);
      }
    }

    // ตรวจสอบว่ามี required columns ครบหรือไม่
    const missingRequired = REQUIRED_COLUMNS.filter(
      (req) => !mappedFields.has(req)
    );

    // สร้างคำแนะนำสำหรับคอลัมน์ที่ไม่รู้จัก
    for (const col of columns) {
      const normalizedCol = col.toLowerCase().trim();
      if (!COLUMN_MAPPINGS[normalizedCol]) {
        // หาคอลัมน์ที่ใกล้เคียง
        const similarColumns = this._findSimilarColumns(normalizedCol);
        if (similarColumns.length > 0) {
          suggestions.push({
            originalColumn: col,
            suggestedMapping: similarColumns,
            message: `Column "${col}" is not recognized. Did you mean: ${similarColumns.join(
              ", "
            )}?`,
          });
        } else {
          suggestions.push({
            originalColumn: col,
            suggestedMapping: [],
            message: `Column "${col}" is not recognized and will be ignored.`,
          });
        }
      }
    }

    const isValid = missingRequired.length === 0;

    return {
      isValid,
      message: isValid
        ? "All required columns found"
        : `Missing required columns: ${missingRequired.join(", ")}`,
      foundColumns: columns,
      mappedFields: Array.from(mappedFields),
      missingRequired,
      suggestions,
      hint: isValid
        ? null
        : {
            requiredColumns: REQUIRED_COLUMNS,
            supportedColumns: Object.keys(COLUMN_MAPPINGS),
            example: {
              name: "John Doe",
              ID_or_Passport_Number: "1234567890123",
              lineUserId: "U1234567890abcdef",
              start_date: "2024-01-15",
              departmentId: 1,
              dayOff: "Sunday",
            },
          },
    };
  }

  // Private Helper Methods: หาชื่อคอลัมน์ที่ใกล้เคียง
  _findSimilarColumns(column) {
    const similar = [];
    const knownColumns = Object.keys(COLUMN_MAPPINGS);

    for (const known of knownColumns) {
      // ตรวจสอบว่ามีส่วนที่เหมือนกันหรือไม่
      if (
        known.includes(column) ||
        column.includes(known) ||
        this._levenshteinDistance(column, known) <= 3
      ) {
        similar.push(known);
      }
    }

    return similar.slice(0, 3); // คืนค่าไม่เกิน 3 รายการ
  }

  // Private Helper Methods: คำนวณระยะทาง Levenshtein ระหว่างสองสตริง
  _levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = new Array(m + 1).fill(null).map(() => new Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  // Private Helper Methods: Normalize ข้อมูลพนักงานให้อยู่ในรูปแบบมาตรฐาน
  _normalizeEmployeesData(data, defaultCompanyId) {
    return data.map((item, index) => {
      // สร้าง object มาตรฐาน
      const normalized = {
        __inputIndex: index,
        name: null,
        ID_or_Passport_Number: null,
        lineUserId: null,
        start_date: null,
        departmentId: null,
        dayOff: null,
        companyId: defaultCompanyId, // ใช้ค่าเริ่มต้นจาก user
      };

      // Map ข้อมูลจาก item
      for (const [key, value] of Object.entries(item)) {
        const normalizedKey = key.toLowerCase().trim();
        const standardField = COLUMN_MAPPINGS[normalizedKey] || key;

        if (STANDARD_FIELDS.has(standardField)) {
          // แปลงค่าว่างเป็น null
          normalized[standardField] =
            value === "" || value === undefined ? null : value;
        }
      }

      // ถ้าไม่มี companyId ให้ใช้ค่าเริ่มต้น
      if (!normalized.companyId) {
        normalized.companyId = defaultCompanyId;
      }

      return normalized;
    });
  }

  // Private Helper Methods: ดำเนินการ import ข้อมูลลงฐานข้อมูล
  async _executeImport(companyId, normalizedData) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    const result = {
      totalRecords: normalizedData.length,
      successCount: 0,
      failedCount: 0,
      skippedRecords: [],
    };

    try {
      // โหลดข้อมูลพนักงานที่มีอยู่แล้ว
      const existingEmployees = await EmployeeModel.findAllByCompanyId(
        companyId
      );
      const existingIDSet = new Set(
        existingEmployees
          .map((e) => e.ID_or_Passport_Number)
          .filter((v) => v !== null && v !== undefined && v !== "")
      );
      const existingLineSet = new Set(
        existingEmployees
          .map((e) => e.lineUserId)
          .filter((v) => v !== null && v !== undefined && v !== "")
      );

      // ใช้ Set สำหรับตรวจสอบค่าซ้ำภายในข้อมูลนำเข้าแบบ real-time
      // (รายการแรกจะถูกเพิ่ม รายการหลังที่ซ้ำจะถูกข้าม)
      const importedIDSet = new Set();
      const importedLineSet = new Set();

      // ประมวลผลแต่ละรายการ แบบเรียบง่ายโดยเรียก helper เล็กๆ
      for (const emp of normalizedData) {
        const index = emp.__inputIndex;

        const skipReasons = this._getImportSkipReasons(emp, {
          existingIDSet,
          existingLineSet,
          importedIDSet,
          importedLineSet,
        });

        if (skipReasons.length > 0) {
          result.skippedRecords.push({
            index,
            data: {
              name: emp.name,
              ID_or_Passport_Number: emp.ID_or_Passport_Number,
              lineUserId: emp.lineUserId,
            },
            reasons: skipReasons,
          });
          result.failedCount++;
          continue;
        }

        const insertData = this._buildInsertData(emp);

        try {
          await EmployeeModel.create(companyId, insertData);
          result.successCount++;
          this._updateSetsAfterInsert(emp, {
            existingIDSet,
            existingLineSet,
            importedIDSet,
            importedLineSet,
          });
        } catch (err) {
          result.skippedRecords.push({
            index,
            data: {
              name: emp.name,
              ID_or_Passport_Number: emp.ID_or_Passport_Number,
              lineUserId: emp.lineUserId,
            },
            reasons: [`Database error: ${err.message}`],
          });
          result.failedCount++;
        }
      }

      await connection.commit();
      connection.release();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Private Helper Methods: ตรวจสอบเหตุผลที่ต้องข้ามรายการนำเข้า (แยกออกเพื่อลดความซับซ้อน)
  _getImportSkipReasons(emp, sets) {
    const { existingIDSet, existingLineSet, importedIDSet, importedLineSet } =
      sets;
    const reasons = [];

    // ตรวจสอบว่ามีชื่อหรือไม่
    if (!emp.name) {
      reasons.push("missing required field: name");
    }

    const id = emp.ID_or_Passport_Number;
    const line = emp.lineUserId;

    // ตรวจสอบค่าซ้ำภายในไฟล์นำเข้า (ข้ามรายการถัดไป)
    if (id && importedIDSet.has(id)) {
      reasons.push(
        "duplicate ID_or_Passport_Number in import data (previous record already added)"
      );
    }
    if (line && importedLineSet.has(line)) {
      reasons.push(
        "duplicate lineUserId in import data (previous record already added)"
      );
    }

    // ตรวจสอบค่าซ้ำกับข้อมูลที่มีอยู่ในฐานข้อมูล
    if (id && existingIDSet.has(id)) {
      reasons.push("ID_or_Passport_Number already exists in company");
    }
    if (line && existingLineSet.has(line)) {
      reasons.push("lineUserId already exists in company");
    }

    return reasons;
  }

  // Private Helper Methods: สร้างข้อมูลที่ต้องส่งไปยัง model (ลดการทำซ้ำ)
  _buildInsertData(emp) {
    return {
      name: emp.name,
      ID_or_Passport_Number: emp.ID_or_Passport_Number,
      lineUserId: emp.lineUserId,
      start_date: emp.start_date,
      departmentId: emp.departmentId,
      dayOff: emp.dayOff,
    };
  }

  // Private Helper Methods: อัปเดตชุดค่าที่ใช้ตรวจสอบการซ้ำหลังการ insert สำเร็จ
  _updateSetsAfterInsert(emp, sets) {
    const { existingIDSet, existingLineSet, importedIDSet, importedLineSet } =
      sets;
    const id = emp.ID_or_Passport_Number;
    const line = emp.lineUserId;

    if (id) {
      existingIDSet.add(id);
      importedIDSet.add(id);
    }
    if (line) {
      existingLineSet.add(line);
      importedLineSet.add(line);
    }
  }

  // Private Helper Methods: หาค่าที่ซ้ำกันสำหรับ key ที่กำหนด
  _findDuplicatesForKey(data, key) {
    const seen = new Set();
    const duplicates = new Set();
    for (const item of data) {
      const val = item[key];
      if (val === null || val === undefined || val === "") continue;
      if (seen.has(val)) duplicates.add(val);
      else seen.add(val);
    }
    return Array.from(duplicates);
  }
}

module.exports = new EmployeeService();
