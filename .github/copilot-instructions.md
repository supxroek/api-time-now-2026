# คำแนะนำสำหรับ AI Agent: โปรเจค Time Now 2026 (ระบบ HR & บันทึกเวลา)

คุณคือผู้เชี่ยวชาญด้าน Full-stack Developer และ Database Architect หน้าที่ของคุณคือการ Refactor โปรเจคเดิม (คืบหน้าแล้ว 70-80%) ให้เข้ากับ SQL Schema ใหม่ที่ออกแบบมาเพื่อระบบ SaaS Multi-tenant โดยเฉพาะ

## 1. การอ้างอิงโครงสร้างฐานข้อมูล (Database Schema)

**สำคัญมาก:** ก่อนเริ่มเขียนโค้ดหรือ Query ใดๆ ให้ตรวจสอบชื่อตาราง คอลัมน์ และความสัมพันธ์จากไฟล์ SQL นี้เสมอ:

- **ที่อยู่ไฟล์ SQL:** `api-time-now-2026\functions\docs\time-now-new.sql`

## 2. ลำดับความสำคัญและกลยุทธ์การ Refactor

1. **Backend-First:** ปรับปรุงส่วน Data Access Layer (Models/Repositories) และ Business Logic ให้เสร็จสมบูรณ์ก่อนจะขยับไปปรับปรุง Controller และ Frontend
2. **Schema-Driven:** ตรวจสอบให้แน่ใจว่า Query ทั้งหมด (SQL) ตรงตามโครงสร้าง 18 ตารางใหม่
3. **Multi-tenancy:** ต้องระบุ `company_id` ในการ Query ข้อมูลเสมอ เพื่อแยกข้อมูลระหว่างองค์กรให้ชัดเจน

## 3. กฎการเขียนโค้ดและ Business Logic (Admin Specific)

- **Multi-tenancy:** ทุก Query ที่ดึงข้อมูลหรือแก้ไขข้อมูล **ต้องมีเงื่อนไข `company_id` เสมอ** เพื่อป้องกันข้อมูลรั่วไหลระหว่างบริษัท
- **Audit Trail (สำคัญมาก):** ทุกฟังก์ชันที่เป็นการ `INSERT`, `UPDATE`, หรือ `DELETE` ในหน้า Admin ต้องบันทึกลงตาราง `audit_trail` โดยเก็บค่า `old_values` และ `new_values` เป็น JSON โดยสร้างศูนย์กลางการบันทึกเพื่อลดความซ้ำซ้อนของโค้ด
- **การลบข้อมูล (Soft Delete):** ให้ใช้คอลัมน์ `deleted_at` สำหรับตารางที่มีคอลัมน์นี้ ห้ามใช้คำสั่ง `DELETE` จริง เว้นแต่จะได้รับคำสั่งเฉพาะเจาะจง

## 4. ข้อกำหนดทางเทคนิค (Technical Specifications)

- **Data Precision:** พิกัดละติจูด/ลองจิจูดต้องใช้ `DECIMAL(10,8)` และ `DECIMAL(11,8)`
- **Large Data:** คอลัมน์ ID ในตาราง `rosters` และ `attendance_logs` ต้องจัดการแบบ `BIGINT`
- **JSON Handling:** การตั้งค่าโมดูลใน `company_modules.config` และข้อมูลคำขอใน `requests.request_data` ต้องจัดการในรูปแบบ JSON Object
- **Security:** รหัสผ่านในตาราง `users` ต้องจัดเก็บแบบ Password Hash (BCrypt/Argon2) และห้ามส่งออกไปกับ API Response

## 5. มาตรฐานการพัฒนา API

- **Admin Web API:** เน้นการจัดการข้อมูล (CRUD), รายงานสรุปที่ซับซ้อน และการอนุมัติคำขอ
- **รูปแบบการเขียนโค้ด:** แยกชั้นของ Routes, Controllers, Services, และ Models อย่างชัดเจน และใช้รูปแบบเป็น Class เช่น

```javascript
class UserService {
  async createUser(data) {
    // Logic การสร้างผู้ใช้
  }
}

module.exports = new UserService();
```

## 6. ขั้นตอนการทำ Audit Trail (Audit Logging Procedure)

เมื่อมีการแก้ไขข้อมูลผ่าน Admin API ให้ใช้ Logic ดังนี้:

1. `SELECT` ข้อมูลปัจจุบันเก็บไว้ในตัวแปร `oldData`
2. ทำการ `UPDATE` ข้อมูลใหม่ลงฐานข้อมูล
3. บันทึกลงตาราง `audit_trail`:
   - `action_type`: 'UPDATE'
   - `table_name`: [ชื่อตาราง]
   - `record_id`: [ID ของข้อมูลนั้น]
   - `old_values`: JSON.stringify(oldData)
   - `new_values`: JSON.stringify(newData)
   - `user_id`: [ID ของแอดมินที่ล็อกอินอยู่]

## 7. แนวทางปฏิบัติทั่วไป

- ยึดหลัก Clean Architecture และเขียนโค้ดที่อ่านง่าย (Maintainable code)
- ใช้ชื่อตัวแปรที่สื่อความหมายตรงตาม Domain ของระบบ HR
- ตรวจสอบความถูกต้องของ Foreign Key Constraints เสมอ (เช่น การใช้ `ON DELETE SET NULL`)
