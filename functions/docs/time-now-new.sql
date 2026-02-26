create table companies
(
    id                   int auto_increment
        primary key,
    name                 varchar(255)                        not null,
    tax_id               varchar(20)                         null,
    email                varchar(255)                        null,
    phone_number         varchar(20)                         null,
    contact_person       varchar(255)                        null,
    address_detail       varchar(255)                        null,
    sub_district         varchar(100)                        null,
    district             varchar(100)                        null,
    province             varchar(100)                        null,
    postal_code          varchar(10)                         null,
    hr_employee_id       int                                 null,
    report_date          int       default 1                 not null,
    employee_limit       int       default 5                 null,
    leave_hub_company_id int                                 null,
    leave_hub_username   varchar(255)                        null,
    leave_hub_password   varchar(255)                        null,
    last_sync_time       datetime                            null,
    created_at           timestamp default CURRENT_TIMESTAMP null
);

create table departments
(
    id               int auto_increment
        primary key,
    company_id       int          null,
    department_name  varchar(255) null,
    head_employee_id int          null,
    constraint departments_ibfk_1
        foreign key (company_id) references companies (id)
);

create index company_id
    on departments (company_id);

create table devices
(
    id            int auto_increment
        primary key,
    company_id    int                  not null,
    name          varchar(255)         null,
    location_name varchar(255)         null,
    description   text                 null,
    hwid          varchar(100)         not null,
    passcode      varchar(50)          null,
    is_active     tinyint(1) default 1 null,
    deleted_at    timestamp            null,
    constraint hwid
        unique (hwid),
    constraint devices_ibfk_1
        foreign key (company_id) references companies (id)
);

create table device_access_controls
(
    id          int auto_increment
        primary key,
    device_id   int                                                  not null,
    target_type enum ('employee', 'department', 'all') default 'all' null,
    target_id   int                                                  null,
    constraint device_access_ibfk_1
        foreign key (device_id) references devices (id)
            on delete cascade
);

create index company_id
    on devices (company_id);

create table modules
(
    id          int auto_increment
        primary key,
    module_key  varchar(50)  null,
    module_name varchar(100) null,
    constraint module_key
        unique (module_key)
);

create table company_modules
(
    id         int auto_increment
        primary key,
    company_id int                  null,
    module_id  int                  null,
    is_enabled tinyint(1) default 1 null,
    config     json                 null,
    constraint company_modules_ibfk_1
        foreign key (company_id) references companies (id),
    constraint company_modules_ibfk_2
        foreign key (module_id) references modules (id)
);

create index company_id
    on company_modules (company_id);

create index module_id
    on company_modules (module_id);

create table ot_templates
(
    id             int auto_increment
        primary key,
    company_id     int                         not null,
    name           varchar(100)                not null,
    start_time     time                        null,
    end_time       time                        null,
    duration_hours decimal(4, 2)               null,
    overtime_rate  decimal(10, 2) default 0.00 not null,
    is_active      tinyint(1)     default 1    null,
    deleted_at     timestamp                   null,
    constraint ot_templates_ibfk_1
        foreign key (company_id) references companies (id)
);

create index company_id
    on ot_templates (company_id);

create table shifts
(
    id               int auto_increment
        primary key,
    company_id       int                                        not null,
    name             varchar(255)                               null,
    type             enum ('fixed', 'flexible') default 'fixed' null,
    start_time       time                                       null,
    end_time         time                                       null,
    is_break         tinyint(1)                 default 1       null,
    break_start_time time                                       null,
    break_end_time   time                                       null,
    is_night_shift   tinyint(1)                 default 0       null,
    deleted_at       timestamp                                  null,
    constraint shifts_ibfk_1
        foreign key (company_id) references companies (id)
);

create table employees
(
    id                    int auto_increment
        primary key,
    company_id            int                                                                not null,
    employee_code         varchar(50)                                                        null,
    department_id         int                                                                null,
    name                  varchar(255)                                                       not null,
    email                 varchar(255)                                                       not null,
    image_url             varchar(255)                                                       null,
    phone_number          varchar(20)                                                        null,
    id_or_passport_number varchar(20)                                                        null,
    line_user_id          varchar(255)                                                       null,
    start_date            date                                                               null,
    resign_date           date                                                               null,
    default_shift_id      int                                                                null,
    shift_mode            enum ('normal', 'custom')                default 'normal'          null,
    weekly_holidays       json                                                               null,
    dayOff_mode           enum ('normal', 'custom')                default 'normal'          null,
    status                enum ('active', 'resigned', 'suspended') default 'active'          null,
    created_at            timestamp                                default CURRENT_TIMESTAMP null,
    deleted_at            timestamp                                                          null,
    constraint uq_employee_code_company
        unique (company_id, employee_code),
    constraint uq_line_company
        unique (line_user_id, company_id),
    constraint employees_ibfk_1
        foreign key (company_id) references companies (id),
    constraint employees_ibfk_3
        foreign key (department_id) references departments (id),
    constraint employees_ibfk_4
        foreign key (default_shift_id) references shifts (id)
            on delete set null
);

alter table companies
    add constraint fk_company_hr
        foreign key (hr_employee_id) references employees (id)
            on delete set null;

alter table departments
    add constraint fk_dept_head
        foreign key (head_employee_id) references employees (id)
            on delete set null;

create index default_shift_id
    on employees (default_shift_id);

create index idx_employee_company_status
    on employees (company_id, status);

create index idx_employee_department
    on employees (department_id);

create index idx_employee_email_company
    on employees (company_id, email);

create table requests
(
    id              int auto_increment
        primary key,
    company_id      int                                                                not null,
    employee_id     int                                                                not null,
    request_type    enum ('correction', 'ot', 'shift_swap')                            null,
    status          enum ('pending', 'approved', 'rejected') default 'pending'         null,
    approver_id     int                                                                null,
    request_data    json                                                               null,
    rejected_reason text                                                               null,
    evidence_image  longtext                                                           null,
    created_at      timestamp                                default CURRENT_TIMESTAMP null,
    approved_at     timestamp                                                          null,
    constraint requests_ibfk_1
        foreign key (company_id) references companies (id),
    constraint requests_ibfk_2
        foreign key (employee_id) references employees (id),
    constraint requests_ibfk_3
        foreign key (approver_id) references employees (id)
);

create index idx_request_company_status
    on requests (company_id, status);

create index idx_requests_approver_status
    on requests (approver_id, status);

create index idx_requests_employee_status
    on requests (employee_id, status);

create table rosters
(
    id                  bigint auto_increment
        primary key,
    company_id          int                                                           not null,
    employee_id         int                                                           not null,
    shift_id            int                                                           not null,
    work_date           date                                                          not null,
    is_ot_allowed       tinyint(1)                          default 0                 null,
    is_public_holiday   tinyint(1)                          default 0                 null,
    leave_status        enum ('none', 'full_day', 'hourly') default 'none'            null,
    leave_hours_data    json                                                          null,
    is_holiday_swap     tinyint(1)                          default 0                 null,
    is_compensatory     tinyint(1)                          default 0                 null,
    source_system       enum ('local', 'leave_hub')         default 'local'           not null,
    base_day_type       varchar(50)                                                   null comment 'เช่น sick_leave, public_holiday, weekly_off',
    source_payload_hash varchar(64)                                                   null comment 'เก็บ Hash ของ JSON จาก LeaveHub กันข้อมูลซ้ำ',
    sync_version        int                                 default 1                 null,
    resolved_at         timestamp                           default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint uq_emp_date
        unique (employee_id, work_date),
    constraint rosters_ibfk_1
        foreign key (employee_id) references employees (id),
    constraint rosters_ibfk_2
        foreign key (shift_id) references shifts (id)
);

create table attendance_logs
(
    id            bigint auto_increment
        primary key,
    company_id    int                                                                           not null,
    employee_id   int                                                                           not null,
    roster_id     bigint                                                                        not null,
    device_id     int                                                                           null,
    log_type      enum ('check_in', 'break_start', 'break_end', 'check_out', 'ot_in', 'ot_out') null,
    log_timestamp datetime                                                                      not null,
    status        enum ('normal', 'late', 'early_exit', 'absent', 'failed')                     null,
    constraint attendance_logs_ibfk_1
        foreign key (employee_id) references employees (id),
    constraint attendance_logs_ibfk_2
        foreign key (roster_id) references rosters (id),
    constraint attendance_logs_ibfk_3
        foreign key (device_id) references devices (id)
);

create index device_id
    on attendance_logs (device_id);

create index idx_log_company_date
    on attendance_logs (company_id, log_timestamp);

create index idx_logs_employee_time_status
    on attendance_logs (employee_id, log_timestamp, status);

create index idx_logs_roster
    on attendance_logs (roster_id);

create index idx_roster_company_date
    on rosters (company_id, work_date);

create index idx_roster_date
    on rosters (work_date);

create index idx_roster_lookup
    on rosters (employee_id, work_date);

create index shift_id
    on rosters (shift_id);

create index company_id
    on shifts (company_id);

create table users
(
    id            int auto_increment
        primary key,
    company_id    int                                                                null,
    employee_id   int                                                                null,
    email         varchar(255)                                                       not null,
    password_hash varchar(255)                                                       not null,
    role          enum ('super_admin', 'admin', 'manager') default 'admin'           null,
    is_active     tinyint(1)                               default 1                 null,
    last_login    timestamp                                                          null,
    created_at    timestamp                                default CURRENT_TIMESTAMP null,
    updated_at    timestamp                                default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint uq_user_email
        unique (email),
    constraint users_ibfk_1
        foreign key (company_id) references companies (id),
    constraint users_ibfk_2
        foreign key (employee_id) references employees (id)
            on delete set null
);

create table audit_trail
(
    id          bigint auto_increment
        primary key,
    company_id  int                                 not null,
    user_id     int                                 not null,
    action_type enum ('INSERT', 'UPDATE', 'DELETE') not null,
    table_name  varchar(50)                         not null,
    record_id   bigint                              not null,
    old_values  json                                null,
    new_values  json                                null,
    ip_address  varchar(45)                         null,
    created_at  timestamp default CURRENT_TIMESTAMP null,
    constraint audit_trail_ibfk_1
        foreign key (company_id) references companies (id),
    constraint audit_trail_ibfk_2
        foreign key (user_id) references users (id)
);

create index idx_audit_company_time
    on audit_trail (company_id, created_at);

create index idx_audit_table_record
    on audit_trail (table_name, record_id);

create index idx_audit_user_time
    on audit_trail (user_id, created_at);

create table refresh_tokens
(
    id         bigint auto_increment
        primary key,
    user_id    int                                  not null,
    token      varchar(512)                         not null,
    expires_at datetime                             not null,
    is_revoked tinyint(1) default 0                 null,
    created_at timestamp  default CURRENT_TIMESTAMP null,
    constraint refresh_tokens_ibfk_1
        foreign key (user_id) references users (id)
            on delete cascade
);

create index idx_token
    on refresh_tokens (token);

create index user_id
    on refresh_tokens (user_id);

create index company_id
    on users (company_id);

create index employee_id
    on users (employee_id);

