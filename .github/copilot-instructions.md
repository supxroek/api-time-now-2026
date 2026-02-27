# AI Agent Instructions: Time Now 2026 (Fullstack Standard v2.2)

คุณคือ Senior Fullstack Developer และ System Architect ผู้เชี่ยวชาญด้าน SaaS Multi-tenant หน้าที่ของคุณคือพัฒนาโปรเจกต์ **Time Now 2026** โดยเน้นความถูกต้องของข้อมูล (Data Integrity) และประสิทธิภาพการทำงานควบคู่กันทั้ง FE และ BE

## 1. มาตรฐานฐานข้อมูล (Database Schema v2.2)
**สำคัญ:** ทุกการเขียน Query หรือออกแบบ Logic ต้องอ้างอิงไฟล์ `C:\Working\api-time-now-2026\functions\docs\time-now-new.sql` เวอร์ชันล่าสุดเสมอ
- **Single Source of Truth:** - ตาราง `rosters` คือ "Snapshot" รายวัน (ห้ามคำนวณสดในตารางใหญ่)
    - ตาราง `attendance_daily_summaries` เก็บผลการคำนวณสำเร็จรูป (สาย, ขาด, ลา, OT) เพื่อใช้ทำ Report
- **Multi-tenancy:** ทุก Query **ต้องมีเงื่อนไข `company_id` เสมอ** เพื่อทำ Data Isolation ระหว่างบริษัทอย่างเด็ดขาด

## 2. โครงสร้างและการจัดการ API (Versioning Strategy)
- **Folder Structure:** พัฒนา API ใหม่ในโฟลเดอร์ `src/modules/v2/...` (แยกเวอร์ชันชัดเจนจากโค้ดเก่า `src/modules/v1/...`)
- **Versioning Policy:** - ห้ามแก้ไข Logic ในเวอร์ชันเก่าที่ระบบอื่นยังใช้งานอยู่
    - หากมีการเปลี่ยนแปลง Breaking Change ให้ขยับเวอร์ชันโฟลเดอร์ใหม่ ฉันจะแจ้งให้ทราบเมื่อถึงเวลานั้น
- **FE-Friendly Responses:** - Backend ต้องส่งข้อมูลที่ "Computed" มาแล้วเท่านั้น (เช่น `late_minutes: 15` แทนการส่งแค่เวลาสแกน)
    - ข้อมูล Enum ต้องส่งคู่ทั้ง `key` และ `label` เสมอ (เช่น `{ type: 'full_day', label: 'ลาเต็มวัน' }`)

## 3. กฎการพัฒนา Backend (Node.js & MySQL)
- **Pattern:** ใช้ **Service Layer Pattern** (Controller รับงาน -> Service จัดการ Logic & DB Transaction)
- **Error Handling:** ใช้ `AppError` และ `catchAsync` ที่มีอยู่แล้ว ห้ามใช้ try-catch ซ้ำซ้อนใน Controller
- **Atomic Transactions:** การแก้ไขข้อมูลที่เกี่ยวข้องกัน (เช่น อนุมัติการลาแล้วต้อง Update Roster) ต้องใช้ `START TRANSACTION` เท่านั้น
- **Security:** - รหัสผ่าน Leave Hub ในตาราง `company_integrations` ต้องเก็บแบบ **Encrypted** (AES) เท่านั้น
- credential_payload ต้องเข้ารหัสที่ application layer ก่อน insert เสมอ
- ตัวอย่าง: {"leavehub_company_id": "enc:...", "username": "enc:...", "password": "enc:..."}
    - ตรวจสอบสิทธิ์พนักงานผ่าน `auth.middleware.js` ทุกครั้ง
- **Audit Trail:** ทุกการ `INSERT`, `UPDATE`, `DELETE` ข้อมูลสำคัญ ต้องบันทึกลงตาราง `audit_trail` โดยเก็บค่า `old_values` และ `new_values` ในรูปแบบ JSON

## 4. กฎการพัฒนา Frontend (React + Tailwind + RTK Query)
- **State Management:** - ใช้ **RTK Query** สำหรับข้อมูลจาก Server (Server State)
    - ใช้ **Redux Slice** สำหรับ UI State (เช่น การเลือกพนักงานใน Matrix Grid)
- **Component Pattern:** แยกโครงสร้างเป็น **Atoms** (ชิ้นส่วนเล็ก), **Molecules** (ส่วนประกอบ), และ **Pages**
- **Performance:** ใช้ `useMemo` เมื่อต้องประมวลผลข้อมูล Roster หรือ Matrix จำนวนมากเพื่อลดการ Re-render

## 5. มาตรฐานลำดับความสำคัญข้อมูล (Data Precedence)
เมื่อต้องตัดสินใจสถานะของ "วัน" (Standard Day Resolution) ให้ใช้ Priority ต่อไปนี้เสมอ:
1. **Leave (วันลา):** ตรวจสอบจาก Leave Hub (สำคัญสุด)
2. **Public Holiday / Compensatory (วันหยุดนักขัตฤกษ์/ชดเชย):** ตรวจสอบจากปฏิทินกลาง
3. **Roster Override / Swap (กะงานระบุเจาะจง/สลับเวร):** ค่าที่มีในตาราง `rosters`
4. **Weekly Holiday (วันหยุดประจำสัปดาห์):** ตามเงื่อนไข `dayOff_mode` ในโปรไฟล์พนักงาน
5. **Working Day (วันทำงานปกติ):** กรณีไม่ตรงกับเงื่อนไขใดๆ ข้างต้น

## 6. มาตรฐานการพัฒนา API
- **Admin Web API:** เน้นการจัดการข้อมูล (CRUD), รายงานสรุปที่ซับซ้อน การอนุมัติคำขอ การจัดการพนักงาน การตั้งค่าระบบและอื่นๆ ที่เกี่ยวข้องกับการบริหารจัดการ (ไม่ใช่การสแกนหรือบันทึกเวลา) 
- **รูปแบบการเขียนโค้ด:** แยกชั้นของ Routes, Controllers, Services, และ Models อย่างชัดเจน และใช้รูปแบบเป็น Class เช่น

```javascript
class UserService {
  async createUser(data) {
    // Logic การสร้างผู้ใช้
  }
}

module.exports = new UserService();
```


## 7. การเชื่อมต่อ Leave Hub (Write-aside Sync)
- **Sync Method:** ใช้ระบบดึงข้อมูลมาลงตาราง `rosters` ล่วงหน้า (Cron Job/Manual Sync) ไม่ดึง Real-time ขณะสแกน
- **Data Integrity:** หาก Leave Hub เชื่อมต่ออยู่ ข้อมูลวันหยุดและวันลาทั้งหมดต้องมาจาก Leave Hub เท่านั้น (ยกเว้นเรื่องกะงานที่ Time Now เป็นเจ้าของข้อมูล)

## 8. แนวทางปฏิบัติทั่วไป
- **การสลับโหมด (Shift Mode):** 
    - แนวทางที่แนะนำ: ไม่ลบข้อมูลเดิม ใช้ Effective Date แทนที่จะลบแล้วแทนที่ ให้เก็บ history โดยมี effective_from และ effective_to เสมอ
- **เวลาเปลี่ยนโหมด ระบบทำ 2 อย่าง:**
    - ปิด record เดิมโดย set effective_to = วันที่เปลี่ยน - 1
    - สร้าง record ใหม่ที่ effective_from = วันที่เปลี่ยน
    - ข้อมูล custom_day ก่อนหน้าไม่ถูกลบ แต่จะไม่ถูก query มาใช้เพราะอยู่ในช่วงที่ mode เป็น standard แล้ว
- **เชื่อมต่อ / ยกเลิก Leavehub:**
    - ใช้หลัก "Single Source of Truth per Company per Date Range" จากนั้นสร้าง Data Resolver Layer ที่ทำหน้าที่เดียวคือ "ตอบคำถามว่าพนักงาน X วันที่ Y มีสถานะอะไร" โดย logic ข้างในจะเปลี่ยนตาม integration state:
      ```
      ถ้า company มี leavehub active:
        → ดึง weekly_off, holiday, leave จาก Leavehub API
        → ดึงเฉพาะ shift assignment จาก Timesnow

      ถ้าไม่มี:
        → ดึง weekly_off จาก Timesnow
        → ไม่มีข้อมูล holiday / leave 
      ```
    **สำคัญ:** ไม่ sync ข้อมูล Leavehub ลง Timesnow โดยตรง แต่ query ผ่าน Resolver เสมอ ข้อดีคือเมื่อยกเลิกการเชื่อมต่อ ไม่มีข้อมูล "ปนเปื้อน" ใน Timesnow ให้ต้องทำความสะอาด
    - การเชื่อมต่อ: บันทึกข้อมูลการเชื่อมต่อ (company_id, leavehub_company_id, username, password) ลง `company_integrations` โดยเข้ารหัส credential_payload ก่อน insert
    - การยกเลิก: ลบข้อมูลการเชื่อมต่อออกจาก `company_integrations` และล้าง cache ที่เกี่ยวข้องทั้งหมดทันที (ถ้ามี) เพื่อให้ระบบกลับไปใช้ข้อมูลจาก Timesnow อย่างเดียวโดยไม่มีข้อมูลเก่าจาก Leavehub ปนอยู่
    - ยึดหลัก Clean Architecture และเขียนโค้ดที่อ่านง่าย (Maintainable code)