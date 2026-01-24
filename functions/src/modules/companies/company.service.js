const CompanyModel = require("./company.model");
const AppError = require("../../utils/AppError");
const auditRecord = require("../../utils/audit.record");

// Company Service
class CompanyService {
  // ==============================================================
  // ดึงข้อมูลโปรไฟล์บริษัท
  async getCompanyProfile(companyId) {
    const company = await CompanyModel.findById(companyId);
    if (!company) {
      throw new AppError("ไม่พบบริษัท", 404);
    }
    return company;
  }

  // ==============================================================
  // อัปเดตข้อมูลโปรไฟล์บริษัท
  async updateCompanyProfile(user, updateData, ipAddress) {
    const companyId = user.company_id;

    // 1. ดึงข้อมูลบริษัทเดิม
    const oldCompany = await CompanyModel.findById(companyId);
    if (!oldCompany) {
      throw new AppError("ไม่พบบริษัท", 404);
    }

    // 2. กรองฟิลด์ที่อนุญาตให้แก้ไข (ความปลอดภัย)
    // ป้องกันการอัปเดตฟิลด์ระบบที่สำคัญ เช่น id, created_at โดยตรงหากถูกส่งมา
    const allowedFields = new Set([
      "name", // ชื่อบริษัท
      "tax_id", // หมายเลขประจำตัวผู้เสียภาษี
      "email", // อีเมลบริษัท
      "phone_number", // เบอร์โทรศัพท์บริษัท
      "contact_person", // ผู้ติดต่อ
      "address_detail", // ที่อยู่บริษัท
      "sub_district", // ตำบล
      "district", // อำเภอ
      "province", // จังหวัด
      "postal_code", // รหัสไปรษณีย์
      "hr_employee_id", // รหัสพนักงานสำหรับตำแหน่ง HR
      "report_date", // วันที่รายงาน
      "employee_limit", // จำนวนพนักงานสูงสุดที่อนุญาต
      "leave_hub_company_id", // รหัสบริษัท Leave Hub (เพื่อเชื่อมต่อกับ Leave Hub)
    ]);

    const cleanData = {};
    Object.keys(updateData).forEach((key) => {
      if (allowedFields.has(key)) {
        cleanData[key] = updateData[key];
      }
    });

    if (Object.keys(cleanData).length === 0) {
      return oldCompany;
    }

    // 3. อัปเดตข้อมูลบริษัท
    await CompanyModel.update(companyId, cleanData);
    const newCompany = { ...oldCompany, ...cleanData };

    // 4. บันทึกประวัติการเปลี่ยนแปลง (Audit Log)
    try {
      await auditRecord({
        userId: user.id,
        companyId: companyId,
        action: "UPDATE",
        table: "companies",
        recordId: companyId,
        oldVal: oldCompany,
        newVal: newCompany,
        ipAddress: ipAddress,
      });
    } catch (err) {
      console.warn("Audit log failed:", err);
    }

    return newCompany;
  }
}

module.exports = new CompanyService();
