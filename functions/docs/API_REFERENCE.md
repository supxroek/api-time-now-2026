# 📚 API Reference - Time Now Backend

> เอกสารอ้างอิง API ทั้งหมดที่เชื่อมต่อกับ CMS Frontend

## 🔐 Authentication

### Base URL

<http://localhost:3000/api>

### Authentication Header

Authorization: Bearer &lt;token&gt;

---

## 📋 สารบัญ

1. [Auth API](#1-auth-api) - การยืนยันตัวตน
2. [Company API](#2-company-api) - ข้อมูลบริษัท
3. [Department API](#3-department-api) - แผนก
4. [Employee API](#4-employee-api) - พนักงาน
5. [Device API](#5-device-api) - อุปกรณ์
6. [Shift API](#6-shift-api) - กะการทำงาน
7. [Overtime API](#7-overtime-api) - การทำงานล่วงเวลา
8. [Request API](#8-request-api) - คำขอ
9. [Dashboard API](#9-dashboard-api) - แดชบอร์ด
10. [Attendance API](#10-attendance-api) - การบันทึกเวลา

---

## 1. Auth API

### 1.1 เข้าสู่ระบบ

```http
POST /api/auth/login
```

**Request Body:**

```json
{
  "email": "admin@company.com",
  "password": "password123"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "admin@company.com",
    "role": "admin",
    "company_id": 1,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response Error (400):**

```json
{
  "success": false,
  "error": "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
}
```

### 1.2 รีเฟรช Token

```http
POST /api/auth/refresh-token
```

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 2. Company API

### 2.1 ดึงข้อมูลบริษัท

```http
GET /api/organization/profile
```

**Response Success (200):**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "บริษัท ทดสอบ จำกัด",
    "address": "123 ถนนสุขุมวิท กรุงเทพฯ",
    "tel": "02-123-4567",
    "email": "info@company.com",
    "hasDepartment": 1
  }
}
```

### 2.2 อัปเดตข้อมูลบริษัท

```http
PATCH /api/organization/profile
```

**Request Body:**

```json
{
  "name": "บริษัท ทดสอบใหม่ จำกัด",
  "address": "456 ถนนสาทร",
  "hasDepartment": 1
}
```

---

## 3. Department API

### 3.1 ดึงรายการแผนกทั้งหมด

```http
GET /api/organization/departments
```

**Response Success (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "departmentName": "HR",
      "headDep_name": "สมชาย ใจดี",
      "headDep_email": "somchai@company.com",
      "headDep_tel": "081-234-5678",
      "employeeCount": 5
    }
  ]
}
```

### 3.2 สร้างแผนกใหม่

```http
POST /api/organization/departments
```

**Request Body:**

```json
{
  "departmentName": "IT",
  "headDep_name": "สมหญิง รักงาน",
  "headDep_email": "somying@company.com",
  "headDep_tel": "081-987-6543"
}
```

**Response Error (400) - ชื่อซ้ำ:**

```json
{
  "success": false,
  "error": "ชื่อแผนก \"IT\" มีอยู่ในระบบแล้ว"
}
```

### 3.3 อัปเดตแผนก

```http
PATCH /api/organization/departments/:id
```

### 3.4 ลบแผนก

```http
DELETE /api/organization/departments/:id
```

**Response Error (404):**

```json
{
  "success": false,
  "error": "ไม่พบแผนกที่ต้องการลบ"
}
```

---

## 4. Employee API

### 4.1 ดึงรายการพนักงาน

```http
GET /api/employees
```

**Query Parameters:**

| Parameter    | Type   | Description                 |
| ------------ | ------ | --------------------------- |
| page         | number | หน้าที่ต้องการ (default: 1) |
| limit        | number | จำนวนต่อหน้า (default: 10)  |
| search       | string | ค้นหาชื่อ                   |
| departmentId | number | กรองตามแผนก                 |

### 4.2 สร้างพนักงานใหม่

```http
POST /api/employees
```

**Request Body:**

```json
{
  "name": "พนักงาน ใหม่",
  "ID_or_Passport_Number": "1234567890123",
  "lineUserId": "U1234567890abcdef",
  "start_date": "2024-01-15",
  "departmentId": 1,
  "dayOff": [0, 6]
}
```

**Response Error (400) - ข้อมูลซ้ำ:**

```json
{
  "success": false,
  "error": "เลขบัตรประชาชนหรือ Line ID นี้มีอยู่ในระบบแล้ว"
}
```

### 4.3 ดึงข้อมูลพนักงานตาม ID

```http
GET /api/employees/:id
```

### 4.4 อัปเดตพนักงาน

```http
PATCH /api/employees/:id
```

### 4.5 บันทึกการลาออก

```http
PATCH /api/employees/:id/resign
```

**Request Body:**

```json
{
  "resign_date": "2024-12-31"
}
```

### 4.6 นำเข้าพนักงานจากไฟล์

```http
POST /api/employees/import
Content-Type: multipart/form-data
```

**Form Data:**

| Field | Type | Description                       |
| ----- | ---- | --------------------------------- |
| file  | File | ไฟล์ Excel (.xlsx, .xls) หรือ CSV |

---

## 5. Device API

### 5.1 ดึงรายการอุปกรณ์

```http
GET /api/devices
```

**Response Success (200):**

```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "id": 1,
        "name": "เครื่อง 1 - ล็อบบี้",
        "hwid": "HWID-001",
        "locationURL": "https://maps.google.com/...",
        "passcode": "123456",
        "employeeIds": [1, 2, 3],
        "employeeCount": 3
      }
    ],
    "total": 1
  }
}
```

### 5.2 เพิ่มอุปกรณ์ใหม่

```http
POST /api/devices
```

**Request Body:**

```json
{
  "name": "เครื่อง 2 - ชั้น 3",
  "hwid": "HWID-002",
  "locationURL": "https://maps.google.com/...",
  "passcode": "654321",
  "employeeIds": []
}
```

**Response Error (409) - HWID ซ้ำ:**

```json
{
  "success": false,
  "error": "HWID นี้ถูกใช้งานแล้ว"
}
```

### 5.3 อัปเดตอุปกรณ์

```http
PATCH /api/devices/:id
```

### 5.4 ลบอุปกรณ์

```http
DELETE /api/devices/:id
```

### 5.5 ซิงค์ข้อมูลอุปกรณ์

```http
POST /api/devices/sync-trigger
```

**Request Body:**

```json
{
  "id": 1
}
```

---

## 6. Shift API

### 6.1 ดึงรายการกะทั้งหมด

```http
GET /api/shifts
```

**Response Success (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "shift_name": "กะเช้า",
      "start_time": "08:00:00",
      "end_time": "17:00:00",
      "break_start_time": "12:00:00",
      "break_end_time": "13:00:00",
      "date": [1, 2, 3, 4, 5],
      "employeeId": [1, 2],
      "is_shift": 1,
      "is_break": 1,
      "is_night_shift": 0
    }
  ]
}
```

### 6.2 สร้างกะใหม่

```http
POST /api/shifts
```

**Request Body:**

```json
{
  "shift_name": "กะบ่าย",
  "start_time": "14:00",
  "end_time": "22:00",
  "break_start_time": "18:00",
  "break_end_time": "19:00",
  "date": [1, 2, 3, 4, 5],
  "employeeId": [],
  "is_shift": 1,
  "is_break": 1,
  "is_night_shift": 0
}
```

**Response Error (400) - ชื่อซ้ำ:**

```json
{
  "success": false,
  "error": "ชื่อกะนี้มีอยู่ในระบบแล้ว"
}
```

### 6.3 อัปเดตกะ

```http
PATCH /api/shifts/:id
```

### 6.4 ลบกะ

```http
DELETE /api/shifts/:id
```

### 6.5 มอบหมายกะให้พนักงาน

```http
POST /api/shifts/assign
```

**Request Body:**

```json
{
  "shiftId": 1,
  "employeeIds": [1, 2, 3]
}
```

---

## 7. Overtime API

### 7.1 ดึงรายการ OT ทั้งหมด

```http
GET /api/overtime
```

### 7.2 สร้าง OT ใหม่

```http
POST /api/overtime
```

**Request Body:**

```json
{
  "overTimeName": "OT วันเสาร์",
  "ot_start_time": "09:00",
  "ot_end_time": "17:00",
  "employeeId": [1, 2]
}
```

**Response Error (400) - ชื่อซ้ำ:**

```json
{
  "success": false,
  "error": "ชื่อ OT นี้มีอยู่ในระบบแล้ว"
}
```

### 7.3 อัปเดต OT

```http
PUT /api/overtime/:id
```

### 7.4 ลบ OT

```http
DELETE /api/overtime/:id
```

---

## 8. Request API

### 8.1 ดึงคำขอที่รอการอนุมัติ

```http
GET /api/requests/pending
```

### 8.2 ดึงประวัติคำขอ

```http
GET /api/requests/history
```

**Query Parameters:**

| Parameter | Type   | Description                               |
| --------- | ------ | ----------------------------------------- |
| page      | number | หน้าที่ต้องการ                            |
| limit     | number | จำนวนต่อหน้า                              |
| status    | string | all / approved / rejected                 |
| type      | string | work_in / work_out / break_in / break_out |
| startDate | string | วันที่เริ่มต้น (YYYY-MM-DD)               |
| endDate   | string | วันที่สิ้นสุด (YYYY-MM-DD)                |

### 8.3 ดึงสถิติคำขอ

```http
GET /api/requests/stats
```

**Response Success (200):**

```json
{
  "success": true,
  "data": {
    "pending": 5,
    "approved": 120,
    "rejected": 10,
    "total": 135
  }
}
```

### 8.4 อนุมัติคำขอ

```http
PATCH /api/requests/:id/approve
```

**Response Error (400):**

```json
{
  "success": false,
  "error": "คำขอนี้ได้รับการดำเนินการแล้ว"
}
```

### 8.5 ปฏิเสธคำขอ

```http
PATCH /api/requests/:id/reject
```

---

## 9. Dashboard API

### 9.1 ดึงข้อมูล Dashboard ทั้งหมด

```http
GET /api/dashboard
```

### 9.2 ดึงสถิติวันนี้

```http
GET /api/dashboard/stats
```

**Response Success (200):**

```json
{
  "success": true,
  "data": {
    "present": 45,
    "late": 3,
    "absent": 2,
    "onBreak": 5,
    "totalEmployees": 50
  }
}
```

### 9.3 ดึงรายการเข้างานวันนี้

```http
GET /api/dashboard/attendance
```

**Query Parameters:**

| Parameter  | Type   | Description                           |
| ---------- | ------ | ------------------------------------- |
| page       | number | หน้าที่ต้องการ                        |
| limit      | number | จำนวนต่อหน้า                          |
| department | string | แผนก (All = ทั้งหมด)                  |
| status     | string | สถานะ (All / present / late / absent) |
| search     | string | ค้นหาชื่อ                             |

### 9.4 ดึงกิจกรรมล่าสุด

```http
GET /api/dashboard/activities
```

**Query Parameters:**

| Parameter | Type   | Description                |
| --------- | ------ | -------------------------- |
| limit     | number | จำนวนกิจกรรม (default: 20) |

### 9.5 ดึงประวัติพนักงาน

```http
GET /api/dashboard/employee/:id/history
```

**Query Parameters:**

| Parameter | Type   | Description           |
| --------- | ------ | --------------------- |
| days      | number | จำนวนวัน (default: 5) |

---

## 10. Attendance API

### 10.1 ดึงข้อมูลการเข้างานวันนี้

```http
GET /api/attendance/today
```

### 10.2 ดึงประวัติการเข้างาน

```http
GET /api/attendance/history
```

### 10.3 ดึงสรุปการเข้างานรายเดือน

```http
GET /api/attendance/summary
```

---

## ⚠️ รูปแบบ Error Response

ทุก API จะส่ง error ในรูปแบบเดียวกัน:

```json
{
  "success": false,
  "error": "ข้อความแสดงข้อผิดพลาด"
}
```

### HTTP Status Codes

| Code | Description                                |
| ---- | ------------------------------------------ |
| 200  | สำเร็จ                                     |
| 201  | สร้างข้อมูลสำเร็จ                          |
| 400  | ข้อมูลไม่ถูกต้อง                           |
| 401  | ไม่ได้รับอนุญาต (Token หมดอายุ/ไม่ถูกต้อง) |
| 403  | ไม่มีสิทธิ์เข้าถึง                         |
| 404  | ไม่พบข้อมูล                                |
| 409  | ข้อมูลซ้ำ (Conflict)                       |
| 500  | เซิร์ฟเวอร์มีปัญหา                         |

---

## 🔗 Frontend Integration

### ไฟล์ที่เกี่ยวข้องใน Frontend

| API Module | Frontend Files                                |
| ---------- | --------------------------------------------- |
| Auth       | `authSlice.js`, `useAuth.js`, `LoginPage.jsx` |
| Company    | `companySlice.js`, `CompanyPage.jsx`          |
| Department | `companySlice.js`, `CompanyPage.jsx`          |
| Employee   | `employeeSlice.js`, `EmployeePage.jsx`        |
| Device     | `companySlice.js`, `CompanyPage.jsx`          |
| Shift      | `shiftSlice.js`, `ShiftPage.jsx`              |
| Overtime   | `overtimeSlice.js`, `ShiftPage.jsx`           |
| Request    | `requestSlice.js`, `RequestPage.jsx`          |
| Dashboard  | `dashboardSlice.js`, `DashboardPage.jsx`      |

---

### อัปเดตล่าสุด: December 2025
