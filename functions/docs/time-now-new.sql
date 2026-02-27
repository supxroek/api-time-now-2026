-- ============================================================
--  TIMESNOW — Final Database Schema
--  Version: 2.2
--  Updated: 2026-02-26
-- ============================================================
--  Changelog v2.1:
--    - ลบ request_ot_details, request_correction_details,
--      request_shift_swap_details ออก (ใช้ request_data JSON แทน)
--    - เพิ่ม column ใน requests เพื่อชดเชยข้อมูลที่เคยอยู่ใน detail tables
--      (target_date, roster_id, ot_template_id)
--    - attendance_logs: ลบ status ออก (ไม่ใช่ข้อมูล log level)
--      เพิ่ม is_manual และ source_request_id แทน
--    - rosters: ลบ flag ซ้ำซ้อน (is_public_holiday, is_holiday_swap,
--      is_compensatory) ออก เนื่องจาก day_type ครอบคลุมแล้ว
--      เพิ่ม attendance_status แทน (computed summary ของวัน)
--    - roster_ot_slots: ลบ status ออก ใช้ requests.status แทน
--      เพิ่ม request_id เชื่อมกับ requests
-- ============================================================
--  Changelog v2.2:
--    - rosters: ลบ attendance_status ออก (ย้ายไป attendance_daily_summaries)
--    - rosters: ลบ leave_status / leave_hours_data ออก
--      เนื่องจาก day_type ครอบคลุม leave type แล้ว
--      รายละเอียดชั่วโมงลาเก็บใน attendance_daily_summaries.leave_hours_data แทน
--    - เพิ่ม attendance_daily_summaries (computed summary ระดับวัน)
--    - requests: เพิ่ม ON DELETE RESTRICT บน roster_id FK
--      เพื่อป้องกัน roster ถูกลบโดยที่ยังมี request อ้างอิงอยู่
--    - เพิ่ม index idx_ads_company_date บน attendance_daily_summaries
-- ============================================================
--  กลุ่ม Table (22 tables):
--    1.  Core           (companies, departments, employees, users)
--    2.  Shifts         (shifts, employee_shift_assignments, employee_shift_custom_days)
--    3.  DayOff         (employee_dayoff_assignments, employee_dayoff_custom_days)
--    4.  Integration    (company_integrations)
--    5.  Devices        (devices, device_access_controls)
--    6.  Modules        (modules, company_modules)
--    7.  OT Templates   (ot_templates)
--    8.  Rosters        (rosters, roster_ot_slots)
--    9.  Attendance     (attendance_logs, attendance_daily_summaries)
--    10. Requests       (requests)
--    11. Audit & Auth   (audit_trail, refresh_tokens)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. CORE
-- ============================================================

CREATE TABLE companies
(
    id             INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(255)                        NOT NULL,
    tax_id         VARCHAR(20)                         NULL,
    email          VARCHAR(255)                        NULL,
    phone_number   VARCHAR(20)                         NULL,
    contact_person VARCHAR(255)                        NULL,
    address_detail VARCHAR(255)                        NULL,
    sub_district   VARCHAR(100)                        NULL,
    district       VARCHAR(100)                        NULL,
    province       VARCHAR(100)                        NULL,
    postal_code    VARCHAR(10)                         NULL,
    hr_employee_id INT                                 NULL,     -- FK เพิ่มภายหลัง (circular ref)
    report_date    INT       DEFAULT 1                 NOT NULL, -- วันที่ปิดรอบรายงาน (1–31)
    employee_limit INT       DEFAULT 5                 NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE departments
(
    id               INT AUTO_INCREMENT PRIMARY KEY,
    company_id       INT          NOT NULL,
    department_name  VARCHAR(255) NOT NULL,
    head_employee_id INT          NULL,                          -- FK เพิ่มภายหลัง (circular ref)
    CONSTRAINT fk_dept_company FOREIGN KEY (company_id) REFERENCES companies (id),
    INDEX idx_dept_company (company_id)
);

CREATE TABLE employees
(
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    company_id            INT                                                       NOT NULL,
    employee_code         VARCHAR(50)                                               NULL,
    department_id         INT                                                       NULL,
    name                  VARCHAR(255)                                              NOT NULL,
    email                 VARCHAR(255)                                              NOT NULL,
    image_url             VARCHAR(255)                                              NULL,
    phone_number          VARCHAR(20)                                               NULL,
    id_or_passport_number VARCHAR(20)                                               NULL,
    line_user_id          VARCHAR(255)                                              NULL,
    start_date            DATE                                                      NULL,
    resign_date           DATE                                                      NULL,
    status                ENUM ('active', 'resigned', 'suspended') DEFAULT 'active' NOT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP                       NOT NULL,
    deleted_at            TIMESTAMP                                                 NULL,
    CONSTRAINT uq_employee_code_company UNIQUE (company_id, employee_code),
    CONSTRAINT uq_line_company UNIQUE (line_user_id, company_id),
    CONSTRAINT fk_emp_company FOREIGN KEY (company_id) REFERENCES companies (id),
    CONSTRAINT fk_emp_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL,
    INDEX idx_employee_company_status (company_id, status),
    INDEX idx_employee_department (department_id),
    INDEX idx_employee_email_company (company_id, email)
);

-- Circular FK — เพิ่มหลัง employees สร้างเสร็จ
ALTER TABLE companies
    ADD CONSTRAINT fk_company_hr FOREIGN KEY (hr_employee_id) REFERENCES employees (id) ON DELETE SET NULL;

ALTER TABLE departments
    ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_employee_id) REFERENCES employees (id) ON DELETE SET NULL;

CREATE TABLE users
(
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT                                                      NULL,
    employee_id   INT                                                      NULL,
    email         VARCHAR(255)                                             NOT NULL,
    password_hash VARCHAR(255)                                             NOT NULL,
    role          ENUM ('super_admin', 'admin', 'manager') DEFAULT 'admin' NOT NULL,
    is_active     TINYINT(1)                               DEFAULT 1       NOT NULL,
    last_login    TIMESTAMP                                                NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP                      NOT NULL,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP                      NOT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_email UNIQUE (email),
    CONSTRAINT fk_user_company FOREIGN KEY (company_id) REFERENCES companies (id),
    CONSTRAINT fk_user_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE SET NULL,
    INDEX idx_user_company (company_id),
    INDEX idx_user_employee (employee_id)
);

-- ============================================================
-- 2. SHIFTS
-- ============================================================

CREATE TABLE shifts
(
    id               INT AUTO_INCREMENT PRIMARY KEY,
    company_id       INT                                        NOT NULL,
    name             VARCHAR(255)                               NOT NULL,
    type             ENUM ('fixed', 'flexible') DEFAULT 'fixed' NOT NULL,
    start_time       TIME                                       NULL,
    end_time         TIME                                       NULL,
    is_break         TINYINT(1)                 DEFAULT 0       NOT NULL,
    break_start_time TIME                                       NULL,
    break_end_time   TIME                                       NULL,
    is_night_shift   TINYINT(1)                 DEFAULT 0       NOT NULL,  -- กะข้ามวัน end_time < start_time
    deleted_at       TIMESTAMP                                  NULL,
    CONSTRAINT fk_shift_company FOREIGN KEY (company_id) REFERENCES companies (id),
    INDEX idx_shift_company (company_id)
);

-- กำหนดกะงานให้พนักงาน พร้อม history ผ่าน effective date
-- Logic เปลี่ยนโหมด:
--   1. UPDATE effective_to ของ record ปัจจุบัน = วันที่เปลี่ยน - 1
--   2. INSERT record ใหม่ effective_from = วันที่เปลี่ยน, effective_to = NULL
CREATE TABLE employee_shift_assignments
(
    id             INT AUTO_INCREMENT PRIMARY KEY,
    company_id     INT                       NOT NULL,
    employee_id    INT                       NOT NULL,
    shift_mode     ENUM ('normal', 'custom') NOT NULL DEFAULT 'normal',
    shift_id       INT                       NULL,     -- ใช้เมื่อ shift_mode = normal, NULL เมื่อ custom
    effective_from DATE                      NOT NULL,
    effective_to   DATE                      NULL,     -- NULL = config ที่ใช้อยู่ปัจจุบัน
    created_by     INT                       NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_esa_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_esa_shift FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE SET NULL,
    CONSTRAINT fk_esa_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    INDEX idx_esa_emp_date (employee_id, effective_from, effective_to),
    INDEX idx_esa_company (company_id)
);

-- กะงานรายวัน ใช้เมื่อ shift_mode = custom
-- custom_days ที่อยู่นอกช่วง effective ของ assignment จะไม่ถูก query มาใช้
CREATE TABLE employee_shift_custom_days
(
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id  INT  NOT NULL,
    employee_id INT  NOT NULL,
    work_date   DATE NOT NULL,
    shift_id    INT  NOT NULL,
    created_by  INT  NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_emp_custom_shift_date UNIQUE (employee_id, work_date),
    CONSTRAINT fk_escd_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_escd_shift FOREIGN KEY (shift_id) REFERENCES shifts (id),
    CONSTRAINT fk_escd_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    INDEX idx_escd_company_date (company_id, work_date)
);

-- ============================================================
-- 3. DAY OFF (ใช้เมื่อไม่ได้เชื่อมต่อ Leavehub)
-- ============================================================

-- กำหนดวันหยุดประจำสัปดาห์ พร้อม history ผ่าน effective date
-- weekly_days: JSON array ของวันในสัปดาห์ เช่น ["SAT","SUN"]
-- ค่าที่รองรับ: "MON","TUE","WED","THU","FRI","SAT","SUN"
CREATE TABLE employee_dayoff_assignments
(
    id             INT AUTO_INCREMENT PRIMARY KEY,
    company_id     INT                       NOT NULL,
    employee_id    INT                       NOT NULL,
    dayoff_mode    ENUM ('normal', 'custom') NOT NULL DEFAULT 'normal',
    weekly_days    JSON                      NULL,     -- ใช้เมื่อ dayoff_mode = normal
    effective_from DATE                      NOT NULL,
    effective_to   DATE                      NULL,     -- NULL = config ที่ใช้อยู่ปัจจุบัน
    created_by     INT                       NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_eda_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_eda_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    INDEX idx_eda_emp_date (employee_id, effective_from, effective_to),
    INDEX idx_eda_company (company_id)
);

-- วันหยุดเฉพาะวัน ใช้เมื่อ dayoff_mode = custom
CREATE TABLE employee_dayoff_custom_days
(
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id  INT          NOT NULL,
    employee_id INT          NOT NULL,
    off_date    DATE         NOT NULL,
    note        VARCHAR(255) NULL,
    created_by  INT          NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_emp_off_date UNIQUE (employee_id, off_date),
    CONSTRAINT fk_edcd_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_edcd_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    INDEX idx_edcd_company_date (company_id, off_date)
);

-- ============================================================
-- 4. INTEGRATION
-- ============================================================

-- credential_payload ต้องเข้ารหัสที่ application layer ก่อน insert เสมอ
-- ตัวอย่าง: {"leavehub_company_id": "enc:...", "username": "enc:...", "password": "enc:..."}
CREATE TABLE company_integrations
(
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    company_id         INT                                    NOT NULL,
    integration_type   ENUM ('leavehub')                     NOT NULL,
    credential_payload JSON                                   NULL,
    status             ENUM ('active', 'inactive') DEFAULT 'inactive' NOT NULL,
    activated_at       DATETIME                               NULL,
    deactivated_at     DATETIME                               NULL,
    last_sync_at       DATETIME                               NULL,
    sync_status        ENUM ('success', 'failed', 'syncing')  NULL,
    sync_error_message TEXT                                   NULL,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP    NOT NULL,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP    NOT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_company_integration UNIQUE (company_id, integration_type),
    CONSTRAINT fk_ci_company FOREIGN KEY (company_id) REFERENCES companies (id),
    INDEX idx_ci_company (company_id)
);

-- ============================================================
-- 5. DEVICES
-- ============================================================

CREATE TABLE devices
(
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT                  NOT NULL,
    name          VARCHAR(255)         NOT NULL,
    location_name VARCHAR(255)         NULL,
    description   TEXT                 NULL,
    hwid          VARCHAR(100)         NOT NULL,
    passcode      VARCHAR(50)          NULL,
    is_active     TINYINT(1) DEFAULT 1 NOT NULL,
    deleted_at    TIMESTAMP            NULL,
    CONSTRAINT uq_hwid UNIQUE (hwid),
    CONSTRAINT fk_device_company FOREIGN KEY (company_id) REFERENCES companies (id),
    INDEX idx_device_company (company_id)
);

-- กำหนดสิทธิ์การเข้าถึงอุปกรณ์
-- target_id = NULL เมื่อ target_type = 'all'
-- target_id = employee.id เมื่อ target_type = 'employee'
-- target_id = department.id เมื่อ target_type = 'department'
CREATE TABLE device_access_controls
(
    id          INT AUTO_INCREMENT PRIMARY KEY,
    device_id   INT                                                  NOT NULL,
    target_type ENUM ('employee', 'department', 'all') DEFAULT 'all' NOT NULL,
    target_id   INT                                                  NULL,
    CONSTRAINT fk_dac_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
    INDEX idx_dac_device (device_id)
);

-- ============================================================
-- 6. MODULES
-- ============================================================

CREATE TABLE modules
(
    id          INT AUTO_INCREMENT PRIMARY KEY,
    module_key  VARCHAR(50)  NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_module_key UNIQUE (module_key)
);

CREATE TABLE company_modules
(
    id         INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT                  NOT NULL,
    module_id  INT                  NOT NULL,
    is_enabled TINYINT(1) DEFAULT 1 NOT NULL,
    config     JSON                 NULL,
    CONSTRAINT uq_company_module UNIQUE (company_id, module_id),
    CONSTRAINT fk_cm_company FOREIGN KEY (company_id) REFERENCES companies (id),
    CONSTRAINT fk_cm_module FOREIGN KEY (module_id) REFERENCES modules (id),
    INDEX idx_cm_company (company_id)
);

-- ============================================================
-- 7. OT TEMPLATES
-- ============================================================

CREATE TABLE ot_templates
(
    id             INT AUTO_INCREMENT PRIMARY KEY,
    company_id     INT                         NOT NULL,
    name           VARCHAR(100)                NOT NULL,
    start_time     TIME                        NULL,
    end_time       TIME                        NULL,
    duration_hours DECIMAL(4, 2)               NULL,
    overtime_rate  DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
    is_active      TINYINT(1)     DEFAULT 1    NOT NULL,
    deleted_at     TIMESTAMP                   NULL,
    CONSTRAINT fk_ot_company FOREIGN KEY (company_id) REFERENCES companies (id),
    INDEX idx_ot_company (company_id)
);

-- ============================================================
-- 8. ROSTERS
-- ============================================================

-- Roster = config ของแต่ละวัน: 1 row ต่อ 1 พนักงาน ต่อ 1 วัน
-- บอกว่าวันนั้น "ควรจะเป็น" อะไร (กะงาน, ประเภทวัน, แหล่งข้อมูล)
-- ไม่บอกว่า "เกิดอะไรขึ้น" จริงๆ — ส่วนนั้นอยู่ใน attendance_daily_summaries
--
-- day_type:
--   workday           = วันทำงานปกติ
--   weekly_off        = วันหยุดประจำสัปดาห์
--   public_holiday    = วันหยุดนักขัตฤกษ์  (มาจาก Leavehub เมื่อ connected)
--   compensated_holiday = วันหยุดชดเชยนักขัต (มาจาก Leavehub)
--   holiday_swap      = วันหยุดสลับ           (มาจาก Leavehub)
--   annual_leave      = ลาพักร้อน             (มาจาก Leavehub)
--   sick_leave        = ลาป่วย                (มาจาก Leavehub)
--   private_leave     = ลากิจ                 (มาจาก Leavehub)
--   unpaid_leave      = ลาไม่รับเงินเดือน         (มาจาก Leavehub)
--   other_leave       = ลาอื่นๆ (ประเภทที่ Leavehub ไม่ระบุ) (มาจาก Leavehub)
CREATE TABLE rosters
(
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT  NOT NULL,
    employee_id   INT  NOT NULL,
    work_date     DATE NOT NULL,

    -- กะงานที่ใช้วันนั้น
    -- NULL ได้: วันหยุด, ลาเต็มวัน, public_holiday ที่ไม่ได้ทำงาน
    shift_id      INT  NULL,

    -- ประเภทวันหลัก — single source of truth สำหรับประเภทวัน
    day_type ENUM (
        'workday',
        'weekly_off',
        'public_holiday',
        'compensated_holiday',
        'holiday_swap',
        'annual_leave',
        'sick_leave',
        'private_leave',
        'unpaid_leave',
        'other_leave'
    ) NOT NULL DEFAULT 'workday',

    -- แหล่งข้อมูลที่ใช้ resolve roster นี้
    source_system ENUM ('local', 'leavehub') DEFAULT 'local' NOT NULL,

    -- รายละเอียดการลาเป็นชั่วโมง (ใช้เมื่อลาไม่เต็มวัน, มาจาก Leavehub)
    -- เช่น [{"start":"09:00","end":"12:00","type":"sick_leave"}]
    leave_hours_data JSON NULL,

    -- OT flag: HR อนุญาตให้ทำ OT วันนี้ได้หรือไม่
    is_ot_allowed TINYINT(1) DEFAULT 0 NOT NULL,

    -- ป้องกัน duplicate sync จาก Leavehub
    source_payload_hash VARCHAR(64)  NULL COMMENT 'SHA-256 ของ payload จาก Leavehub',
    sync_version        INT          DEFAULT 1 NOT NULL,
    resolved_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_emp_work_date UNIQUE (employee_id, work_date),
    CONSTRAINT fk_roster_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_roster_shift FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE SET NULL,
    INDEX idx_roster_company_date (company_id, work_date),
    INDEX idx_roster_emp_date (employee_id, work_date),
    INDEX idx_roster_date (work_date),
    INDEX idx_roster_shift (shift_id)
);

-- OT Slots: แยกจาก roster เพื่อรองรับ OT ข้ามวัน และหลายช่วงต่อวัน
-- status การอนุมัติ OT อ่านจาก requests.status ผ่าน request_id
-- ot_end = NULL หมายถึง OT ยังไม่สิ้นสุด (กำลังทำอยู่)
CREATE TABLE roster_ot_slots
(
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    roster_id      BIGINT NOT NULL,
    company_id     INT    NOT NULL,
    employee_id    INT    NOT NULL,
    ot_date        DATE   NOT NULL,    -- อาจ != work_date กรณี night shift OT ข้ามวัน
    ot_start       DATETIME NOT NULL,
    ot_end         DATETIME NULL,      -- NULL = OT ยังไม่สิ้นสุด
    ot_template_id INT    NULL,
    request_id     INT    NULL,        -- FK → requests.id เพื่ออ่าน approval status
    approved_by    INT    NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_ros_roster FOREIGN KEY (roster_id) REFERENCES rosters (id) ON DELETE CASCADE,
    CONSTRAINT fk_ros_ot_template FOREIGN KEY (ot_template_id) REFERENCES ot_templates (id) ON DELETE SET NULL,
    CONSTRAINT fk_ros_approved_by FOREIGN KEY (approved_by) REFERENCES employees (id) ON DELETE SET NULL,
    INDEX idx_ros_employee_date (employee_id, ot_date),
    INDEX idx_ros_roster (roster_id),
    INDEX idx_ros_request (request_id),
    INDEX idx_ros_company_date (company_id, ot_date)
);

-- ============================================================
-- 9. ATTENDANCE
-- ============================================================

-- Attendance Logs: บันทึก punch event ดิบ 1 event ต่อ 1 row
-- ไม่มี status ที่นี่ — status เป็นการประเมินระดับวัน ให้อยู่ใน attendance_daily_summaries
-- is_manual = true: log นี้ถูก insert โดย HR ผ่าน correction request
-- is_manual = false: log มาจากอุปกรณ์จริง
CREATE TABLE attendance_logs
(
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id        INT      NOT NULL,
    employee_id       INT      NOT NULL,
    roster_id         BIGINT   NOT NULL,
    device_id         INT      NULL,
    log_type          ENUM ('check_in', 'break_start', 'break_end', 'check_out', 'ot_in', 'ot_out') NOT NULL,
    log_timestamp     DATETIME NOT NULL,
    is_manual         TINYINT(1) DEFAULT 0 NOT NULL,  -- false = จากอุปกรณ์, true = manual โดย HR
    source_request_id INT      NULL,                  -- FK → requests.id (NULL ถ้า is_manual = false)
    CONSTRAINT fk_al_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_al_roster FOREIGN KEY (roster_id) REFERENCES rosters (id),
    CONSTRAINT fk_al_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE SET NULL,
    INDEX idx_al_company_date (company_id, log_timestamp),
    INDEX idx_al_employee_time (employee_id, log_timestamp),
    INDEX idx_al_roster (roster_id),
    INDEX idx_al_device (device_id)
);

-- Attendance Daily Summaries: ผลสรุปการเข้างานระดับวัน (computed table)
-- คำนวณใหม่เมื่อ:
--   - มี attendance_log เพิ่ม/แก้ไข (check_in, check_out, ot_in, ot_out)
--   - correction request ถูกอนุมัติ
--   - วันผ่านไป (end-of-day job ตรวจ absent)
--   - roster ถูก recalculate (เปลี่ยน shift, leavehub sync)
--
-- attendance_status:
--   pending     = ยังไม่ถึงวัน หรือยังอยู่ระหว่างวัน (ยังไม่ check_out)
--   normal      = เข้า-ออกตรงเวลา ไม่สาย ไม่ออกก่อน
--   late        = เข้างานสายเกิน tolerance ที่กำหนด
--   early_exit  = ออกก่อนเวลาเกิน tolerance ที่กำหนด
--   late_and_early_exit = สายและออกก่อนเกิน tolerance ที่กำหนด
--   absent      = ไม่มี log เลย (ไม่ได้ลา, ไม่ใช่วันหยุด)
--   leave       = ลา (day_type เป็น *_leave)
--   holiday     = วันหยุด (day_type เป็น weekly_off / public_holiday / ...)
CREATE TABLE attendance_daily_summaries
(
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id          INT    NOT NULL,
    employee_id         INT    NOT NULL,
    roster_id           BIGINT NOT NULL,
    work_date           DATE   NOT NULL,

    -- เวลาจริงที่บันทึกได้
    first_check_in      DATETIME NULL,  -- เวลาที่ check_in ครั้งแรกของวัน (รวม OT)
    last_check_out      DATETIME NULL,  -- เวลาที่ check_out ครั้งสุดท้ายของวัน (รวม OT)

    -- สรุปเวลา (หน่วย: นาที)
    total_work_minutes  INT DEFAULT 0 NOT NULL,  -- เวลาทำงานสุทธิ (หักพัก)
    break_minutes       INT DEFAULT 0 NOT NULL,  -- เวลาพักรวม
    late_minutes        INT DEFAULT 0 NOT NULL,  -- สายกี่นาที (0 ถ้าไม่สาย)
    early_exit_minutes  INT DEFAULT 0 NOT NULL,  -- ออกก่อนกี่นาที (0 ถ้าไม่ออกก่อน)
    total_ot_minutes    INT DEFAULT 0 NOT NULL,  -- OT รวมทุกช่วง

    attendance_status   ENUM (
        'pending',
        'normal',
        'late',
        'early_exit',
        'late_and_early_exit',
        'absent',
        'leave',
        'holiday'
    ) NOT NULL DEFAULT 'pending',

    calculated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_ads_employee_date UNIQUE (employee_id, work_date),
    CONSTRAINT fk_ads_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_ads_roster FOREIGN KEY (roster_id) REFERENCES rosters (id),
    INDEX idx_ads_company_date (company_id, work_date),
    INDEX idx_ads_status (company_id, attendance_status, work_date),
    INDEX idx_ads_roster (roster_id)
);

-- ============================================================
-- 10. REQUESTS
-- ============================================================

-- คำร้องหลักทุกประเภท รายละเอียดเฉพาะประเภทเก็บใน request_data JSON
-- target_date, roster_id, ot_template_id คือ denormalized fields
-- เพื่อให้ filter/sort/join ได้โดยตรงโดยไม่ต้อง parse JSON
--
-- โครงสร้าง request_data:
--
-- type = correction:
-- {
--   "date":        "2026-02-12",
--   "log_type":        "check_in",
--   "time": "08:30:00",
--   "reason":          "เครื่องสแกนหน้าบริษัทไม่ติดช่วงเช้า"
-- }
--
-- type = ot:
-- {
--   "date":            "2026-02-12",
--   "ot_template_id":  1,
--   "reason":          "อยู่ช่วยงานติดตั้งเซิร์ฟเวอร์ใหม่ของลูกค้าให้เสร็จตามกำหนด"
-- }
--
-- type = shift_swap:
-- {
--   "date":              "2026-02-20",
--   "from_shift_id":          1,
--   "to_shift_id":            3,
--   "swap_with_employee_id":  null,
--   "reason":                 "มีความจำเป็นต้องพาบิดาไปพบแพทย์ตามนัดในเวลาเช้า"
-- }
CREATE TABLE requests
(
    id             INT AUTO_INCREMENT PRIMARY KEY,
    company_id     INT                                                       NOT NULL,
    employee_id    INT                                                       NOT NULL,
    request_type   ENUM ('correction', 'ot', 'shift_swap')                   NOT NULL,
    status         ENUM ('pending', 'approved', 'rejected') DEFAULT 'pending' NOT NULL,
    approver_id    INT                                                       NULL,

    -- Denormalized fields สำหรับ query ตรงโดยไม่ต้อง parse JSON
    target_date    DATE   NULL,   -- วันที่ขอ OT / วันที่แก้ไข / วันสลับกะ
    roster_id      BIGINT NULL,   -- roster ที่เกี่ยวข้อง (correction, ot)
    ot_template_id INT    NULL,   -- เฉพาะ request_type = ot

    request_data   JSON         NULL,
    rejected_reason TEXT         NULL,
    evidence_image  LONGTEXT NULL,  -- URL รูปหลักฐาน/base64 encoded image
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_at     TIMESTAMP NULL,

    CONSTRAINT fk_req_company FOREIGN KEY (company_id) REFERENCES companies (id),
    CONSTRAINT fk_req_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_req_approver FOREIGN KEY (approver_id) REFERENCES employees (id) ON DELETE SET NULL,
    -- RESTRICT: ป้องกัน roster ถูกลบ ในขณะที่ยังมี request pending อ้างอิงอยู่
    CONSTRAINT fk_req_roster FOREIGN KEY (roster_id) REFERENCES rosters (id) ON DELETE RESTRICT,
    CONSTRAINT fk_req_ot_template FOREIGN KEY (ot_template_id) REFERENCES ot_templates (id) ON DELETE SET NULL,
    INDEX idx_req_company_status (company_id, status),
    INDEX idx_req_employee_status (employee_id, status),
    INDEX idx_req_approver_status (approver_id, status),
    INDEX idx_req_target_date (company_id, target_date),
    INDEX idx_req_roster (roster_id)
);

-- FK ที่ต้องเพิ่มภายหลัง (circular หรือ forward ref)
ALTER TABLE roster_ot_slots
    ADD CONSTRAINT fk_ros_request FOREIGN KEY (request_id) REFERENCES requests (id) ON DELETE SET NULL;

ALTER TABLE attendance_logs
    ADD CONSTRAINT fk_al_source_request FOREIGN KEY (source_request_id) REFERENCES requests (id) ON DELETE SET NULL;

-- ============================================================
-- 11. AUDIT & AUTHENTICATION
-- ============================================================

CREATE TABLE audit_trail
(
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id  INT                                 NOT NULL,
    user_id     INT                                 NOT NULL,
    action_type ENUM ('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    table_name  VARCHAR(50)                         NOT NULL,
    record_id   BIGINT                              NOT NULL,
    old_values  JSON                                NULL,
    new_values  JSON                                NULL,
    ip_address  VARCHAR(45)                         NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_at_company FOREIGN KEY (company_id) REFERENCES companies (id),
    CONSTRAINT fk_at_user FOREIGN KEY (user_id) REFERENCES users (id),
    INDEX idx_audit_company_time (company_id, created_at),
    INDEX idx_audit_table_record (table_name, record_id),
    INDEX idx_audit_user_time (user_id, created_at)
);

CREATE TABLE refresh_tokens
(
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT                                  NOT NULL,
    token      VARCHAR(512)                         NOT NULL,
    expires_at DATETIME                             NOT NULL,
    is_revoked TINYINT(1) DEFAULT 0                 NOT NULL,
    created_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_rt_token (token),
    INDEX idx_rt_user (user_id)
);

SET FOREIGN_KEY_CHECKS = 1;