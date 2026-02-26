# Time Now 2026 - Day Resolution Standard (Production Draft)

เอกสารนี้กำหนดมาตรฐานกลางสำหรับการคำนวณสถานะรายวัน (Day Resolution), การประกบกะงาน (Effective Shift), โครงสร้าง API payload และมาตรฐาน Error Code ให้เหมือนกันทั้งระบบ (Admin, User, Report, Calendar, Attendance Scan)

## 1) Scope และเป้าหมาย

### In Scope

- การเลือกแหล่งข้อมูลวัน (day source): `local` หรือ `leave_hub`
- การคำนวณ `base_day_status` ด้วย Data Precedence เดียวกันทุก endpoint
- การคำนวณ `effective_shift` (normal/custom)
- มาตรฐาน payload ที่ส่งให้ frontend
- มาตรฐาน error code สำหรับ business/domain integration

### Out of Scope (เอกสารนี้ยังไม่ลงรายละเอียด)

- สูตรคำนวณ OT เชิงลึกทุกรูปแบบตามนโยบายบริษัท
- Geofencing แบบหลาย polygon
- Approval workflow หลายชั้นแบบ dynamic policy

---

## 2) Core Principles (MUST)

1. Backend Calculate, Frontend Visualize

- ฝั่ง Backend ต้องคำนวณ status/time metrics ทั้งหมด
- ฝั่ง Frontend ห้ามคำนวณสาย/OT/ขาดงานเอง

2. Single Source Decision

- ทุก flow (scan/report/calendar/request) ต้องผ่าน service ตัดสินใจวันเดียวกัน

3. Multi-tenant Isolation

- ทุก query ต้องผูก `company_id` เสมอ
- ห้าม query ข้าม tenant แม้มี `employee_id` ตรงกัน

4. Deterministic Precedence

- ลำดับความสำคัญของสถานะวันต้องคงที่และทดสอบซ้ำได้

---

## 3) Data Source Truth

ระบบใช้เงื่อนไขบริษัทเป็นตัวตัดสิน `day_source`

- ถ้า `companies.leave_hub_company_id IS NOT NULL` => `day_source = leave_hub`
- ถ้า `companies.leave_hub_company_id IS NULL` => `day_source = local`

> หมายเหตุ: แม้เชื่อม Leave Hub แล้ว ข้อมูลกะงาน (`shift`, `shift_mode`) ยังใช้จาก Time Now ตามเดิม

---

## 4) Decision Table - Base Day Resolution

### 4.1 Integrated Mode (`day_source = leave_hub`)

| Priority | Condition                           | base_day_status                           | Source fields (หลัก)                                   |
| -------- | ----------------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| 1        | พบ leave approved (full day/hourly) | `leave`                                   | `rosters.leave_status`, `rosters.leave_hours_data`     |
| 2        | พบ holiday swap active              | `holiday_swap`                            | `rosters.is_holiday_swap`                              |
| 3        | เป็นวันนักขัต/ชดเชย                 | `public_holiday` / `compensatory_holiday` | `rosters.is_public_holiday`, `rosters.is_compensatory` |
| 4        | เป็นวันหยุดประจำสัปดาห์             | `weekly_holiday`                          | ค่า weekly holiday ที่ sync ลง roster/derived result   |
| 5        | ไม่เข้าเงื่อนไขข้างต้น              | `working_day`                             | default                                                |

### 4.2 Standard Mode (`day_source = local`)

| Priority | Condition                                     | base_day_status           |
| -------- | --------------------------------------------- | ------------------------- |
| 1        | มี roster override (เช่น leave/holiday flags) | ตาม flag ที่ระบุใน roster |
| 2        | ตรงวันหยุดประจำสัปดาห์จาก employee policy     | `weekly_holiday`          |
| 3        | ไม่เข้าเงื่อนไขข้างต้น                        | `working_day`             |

---

## 5) Decision Table - Effective Shift

| employee.shift_mode | Rule                                           | effective_shift       |
| ------------------- | ---------------------------------------------- | --------------------- |
| `custom`            | ถ้ามี roster ของวันนั้น ใช้ `rosters.shift_id` | `custom_roster_shift` |
| `normal`            | ใช้ `employees.default_shift_id`               | `default_shift`       |

Validation rules (MUST)

- ถ้า `shift_mode=custom` แต่ไม่มี roster ของวันนั้น => `SHIFT_NOT_ASSIGNED`
- ถ้า `shift_mode=normal` แต่ไม่มี `default_shift_id` => `DEFAULT_SHIFT_MISSING`

---

## 6) API Contract Standard

## 6.1 Resolve Day (MVP)

Endpoint:

- `GET /api/day-resolution/employee/:employeeId?date=YYYY-MM-DD`

Response (success):

```json
{
  "status": "success",
  "data": {
    "resolution": {
      "company_id": 12,
      "employee_id": 88,
      "work_date": "2026-02-24",
      "day_source": "leave_hub",
      "base_day_status": "leave",
      "base_day_reason": "leave_status=full_day",
      "effective_shift": {
        "mode": "custom",
        "source": "roster",
        "shift_id": 5,
        "name": "Morning Shift",
        "start_time": "09:00:00",
        "end_time": "18:00:00"
      },
      "flags": {
        "is_public_holiday": false,
        "is_compensatory": false,
        "is_holiday_swap": false,
        "leave_status": "full_day"
      },
      "roster_id": 12345,
      "resolved_at": "2026-02-24T03:45:00.000Z"
    }
  }
}
```

---

## 6.2 Attendance Scan (Standard Target Contract)

Endpoint (target):

- `POST /api/attendance-logs`

Request (ตัวอย่าง):

```json
{
  "employee_id": 88,
  "device_id": 7,
  "log_type": "check_in",
  "log_timestamp": "2026-02-24T08:58:00+07:00",
  "latitude": 13.756331,
  "longitude": 100.501762,
  "idempotency_key": "scan-88-20260224-085800-abc123"
}
```

Response (target shape):

```json
{
  "status": "success",
  "data": {
    "log": {
      "id": 91234,
      "company_id": 12,
      "employee_id": 88,
      "roster_id": 12345,
      "log_type": "check_in",
      "log_timestamp": "2026-02-24T01:58:00.000Z",
      "attendance_status": "normal",
      "idempotent_reused": false,
      "timezone": "Asia/Bangkok",
      "late_minutes": 0,
      "early_exit_minutes": 0,
      "ot_minutes": 0,
      "absence": false,
      "compensatory_eligibility": false
    },
    "resolution": {
      "day_source": "leave_hub",
      "base_day_status": "leave",
      "effective_shift_mode": "custom"
    }
  }
}
```

---

## 7) Error Code Standard

โครงสร้าง response กรณี error:

```json
{
  "status": "error",
  "error": {
    "code": "SHIFT_NOT_ASSIGNED",
    "message": "ไม่พบกะงานสำหรับวันที่ระบุ",
    "details": {}
  }
}
```

### 7.1 Domain / Validation

| Code                    | HTTP | ความหมาย                                 |
| ----------------------- | ---- | ---------------------------------------- |
| `INVALID_DATE_FORMAT`   | 400  | วันที่ไม่อยู่ในรูปแบบ `YYYY-MM-DD`       |
| `EMPLOYEE_NOT_FOUND`    | 404  | ไม่พบพนักงานในบริษัทนี้                  |
| `DEFAULT_SHIFT_MISSING` | 422  | พนักงานโหมด normal แต่ไม่มีกะเริ่มต้น    |
| `SHIFT_NOT_ASSIGNED`    | 422  | พนักงานโหมด custom แต่ไม่พบ roster shift |
| `ROSTER_NOT_FOUND`      | 404  | ไม่พบ roster ของวันนั้น                  |

### 7.2 Multi-tenant / Authz

| Code                         | HTTP | ความหมาย                          |
| ---------------------------- | ---- | --------------------------------- |
| `CROSS_TENANT_ACCESS_DENIED` | 403  | เรียกข้อมูลข้ามบริษัท             |
| `FORBIDDEN_ROLE`             | 403  | สิทธิ์ไม่พอ                       |
| `UNAUTHORIZED`               | 401  | ไม่มี token หรือ token ไม่ถูกต้อง |

### 7.3 LeaveHub Integration

| Code                       | HTTP    | ความหมาย                       |
| -------------------------- | ------- | ------------------------------ |
| `LEAVEHUB_NOT_CONNECTED`   | 400     | ยังไม่เชื่อม LeaveHub          |
| `LEAVEHUB_AUTH_FAILED`     | 502     | login LeaveHub ไม่สำเร็จ       |
| `LEAVEHUB_API_UNAVAILABLE` | 503     | ปลายทาง LeaveHub ใช้งานไม่ได้  |
| `LEAVEHUB_DATA_STALE`      | 200/206 | ใช้ snapshot ล่าสุดแทนข้อมูลสด |

---

## 8) Processing Standard

### 8.1 Day Resolution Pipeline

1. Identify company + employee
2. Resolve `day_source`
3. Fetch roster snapshot (by employee/date)
4. Resolve `base_day_status` ตาม precedence
5. Resolve `effective_shift`
6. Return normalized resolution payload

### 8.2 Attendance Scan Pipeline

1. Identify employee
2. Resolve day
3. Validate device access/location
4. Calculate attendance status/late/ot
5. Write logs + update daily summary ใน transaction เดียว
6. Audit trail

---

## 9) Timezone & Normalization

MUST:

- ระบบต้องกำหนด policy เดียวทั้งระบบ: `Asia/Bangkok` (แนะนำ)
- DB `datetime/timestamp` ควร normalize ก่อนบันทึก
- API response ควรส่ง ISO string

Runtime Policy (Implemented)

- Attendance processor ใช้ timezone กลางจาก `src/utils/date.js` (`DEFAULT_TZ = Asia/Bangkok`)
- การคำนวณ `late_minutes` เทียบกับ `shift.start_time + ATTENDANCE_GRACE_MINUTES`
- การคำนวณ `early_exit_minutes` เทียบกับ `shift.end_time`
- การคำนวณ `ot_minutes` จาก `ot_in -> ot_out` หรือ `check_out` ที่เกิน `shift.end_time`

---

## 9.1 Idempotent Processor (Scan)

MUST:

- Endpoint `POST /api/attendance-logs` ต้องกันข้อมูลซ้ำจาก retry/network
- ใช้ duplicate guard ภายใน transaction โดยตรวจ `(company_id, employee_id, roster_id, log_type, timestamp window, device_id)`
- หากพบรายการซ้ำในช่วงเวลาเดียวกัน ให้คืนรายการเดิมพร้อม `idempotent_reused = true` และไม่ insert ซ้ำ

Config:

- `ATTENDANCE_IDEMPOTENT_WINDOW_SECONDS` (default: `120`)

---

## 10) Rollout Plan (แนะนำ)

Phase 1 (ตอนนี้)

- เพิ่ม endpoint Day Resolution กลาง
- ผูกหน้า Calendar/Report ให้เรียก endpoint นี้

Phase 2

- ปรับ attendance create ให้เรียก Day Resolution ก่อนคำนวณจริง
- เพิ่ม idempotency key สำหรับการสแกน

Phase 3

- เพิ่ม sync job tables + stale flags + monitoring/alert

---

## 11) Backward Compatibility

- Endpoint ใหม่ไม่กระทบ endpoint เดิม
- ใช้ payload shape มาตรฐานเดียวกันเพื่อให้ frontend migrate ทีละหน้าได้
- หากยังไม่มีข้อมูลบาง field ให้ส่ง `null` แต่ key ต้องคงเดิม
