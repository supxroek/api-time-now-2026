const AppError = require("../../../utils/AppError");
const auditRecord = require("../../../utils/audit.record");
const OffsiteAssignmentModel = require("./offsite_assignment.model");

class OffsiteAssignmentService {
  static ALLOWED_FIELDS = new Set([
    "employee_id",
    "target_date",
    "location_url",
    "latitude",
    "longitude",
    "radius_meters",
    "is_active",
  ]);

  /**
   * แยกพิกัดจาก Google Maps URL
   * รองรับหลายรูปแบบ: @lat,lng / ?q=lat,lng / place/lat,lng
   */
  static parseCoordinatesFromUrl(url) {
    if (!url) return null;

    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /place\/(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const lat = Number.parseFloat(match[1]);
        const lng = Number.parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { latitude: lat, longitude: lng };
        }
      }
    }

    return null;
  }

  filterAllowedFields(payload) {
    const filtered = {};
    Object.keys(payload || {}).forEach((key) => {
      if (OffsiteAssignmentService.ALLOWED_FIELDS.has(key)) {
        filtered[key] = payload[key];
      }
    });
    return filtered;
  }

  mapRow(row) {
    return {
      id: row.id,
      employee_id: row.employee_id,
      company_id: row.company_id,
      target_date: row.target_date,
      location_url: row.location_url,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
      radius_meters: Number(row.radius_meters || 200),
      is_active: Number(row.is_active || 0) === 1,
      created_at: row.created_at,
      employee_name: row.employee_name || null,
      employee_code: row.employee_code || null,
      department_name: row.department_name || null,
    };
  }

  async getOverview(companyId, query = {}) {
    const limit = Math.min(Number(query.limit || 500), 1000);

    const [assignmentsRaw, stats, employees] = await Promise.all([
      OffsiteAssignmentModel.listForOverview(companyId, limit),
      OffsiteAssignmentModel.getStats(companyId),
      OffsiteAssignmentModel.listEmployeesForDropdown(companyId),
    ]);

    const assignments = assignmentsRaw.map((row) => this.mapRow(row));

    return {
      contract_version: "v2.offsite-assignments.overview.2026-01-01",
      stats: {
        total: Number(stats.total || 0),
        active: Number(stats.active || 0),
        inactive: Number(stats.inactive || 0),
        today: Number(stats.today || 0),
      },
      assignments: {
        total: assignments.length,
        items: assignments,
      },
      employees: {
        total: employees.length,
        items: employees,
      },
      generated_at: new Date().toISOString(),
    };
  }

  async createAssignment(user, payload, ipAddress) {
    const companyId = user.company_id;
    const cleanData = this.filterAllowedFields(payload);

    if (!cleanData.employee_id) {
      throw new AppError("กรุณาเลือกพนักงาน", 400);
    }
    if (!cleanData.target_date) {
      throw new AppError("กรุณาระบุวันที่", 400);
    }
    if (!cleanData.location_url?.trim()) {
      throw new AppError("กรุณาระบุลิงก์ตำแหน่ง Google Maps", 400);
    }

    // ตรวจ duplicate
    const duplicate = await OffsiteAssignmentModel.findDuplicate(
      cleanData.employee_id,
      cleanData.target_date,
    );
    if (duplicate) {
      throw new AppError("พนักงานคนนี้มีงานนอกสถานที่ในวันดังกล่าวแล้ว", 400);
    }

    // แยกพิกัดจาก URL
    const coords = OffsiteAssignmentService.parseCoordinatesFromUrl(
      cleanData.location_url,
    );

    const dataToCreate = {
      employee_id: Number(cleanData.employee_id),
      company_id: companyId,
      target_date: cleanData.target_date,
      location_url: cleanData.location_url.trim(),
      latitude: cleanData.latitude || coords?.latitude || null,
      longitude: cleanData.longitude || coords?.longitude || null,
      radius_meters: Number(cleanData.radius_meters || 200),
      is_active: 1,
    };

    const newId = await OffsiteAssignmentModel.create(dataToCreate);
    const created = await OffsiteAssignmentModel.findByIdAndCompanyId(
      newId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "INSERT",
        table: "offsite_assignments",
        recordId: newId,
        oldVal: null,
        newVal: created,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 offsite create):", error);
    }

    return created;
  }

  async updateAssignment(user, assignmentId, payload, ipAddress) {
    const companyId = user.company_id;
    const oldRecord = await OffsiteAssignmentModel.findByIdAndCompanyId(
      assignmentId,
      companyId,
    );

    if (!oldRecord) {
      throw new AppError("ไม่พบข้อมูลงานนอกสถานที่", 404);
    }

    const cleanData = this.filterAllowedFields(payload);

    // ตรวจ duplicate ถ้าเปลี่ยนพนักงานหรือวันที่
    const empId = cleanData.employee_id || oldRecord.employee_id;
    const date = cleanData.target_date || oldRecord.target_date;
    if (cleanData.employee_id || cleanData.target_date) {
      const duplicate = await OffsiteAssignmentModel.findDuplicate(
        empId,
        date,
        assignmentId,
      );
      if (duplicate) {
        throw new AppError("พนักงานคนนี้มีงานนอกสถานที่ในวันดังกล่าวแล้ว", 400);
      }
    }

    // ถ้ามี location_url ใหม่ พยายาม parse พิกัด
    if (cleanData.location_url) {
      cleanData.location_url = cleanData.location_url.trim();
      const coords = OffsiteAssignmentService.parseCoordinatesFromUrl(
        cleanData.location_url,
      );
      if (coords && !cleanData.latitude) {
        cleanData.latitude = coords.latitude;
      }
      if (coords && !cleanData.longitude) {
        cleanData.longitude = coords.longitude;
      }
    }

    if (cleanData.is_active !== undefined) {
      cleanData.is_active = Number(cleanData.is_active);
    }

    if (cleanData.radius_meters !== undefined) {
      cleanData.radius_meters = Number(cleanData.radius_meters);
    }

    if (cleanData.employee_id !== undefined) {
      cleanData.employee_id = Number(cleanData.employee_id);
    }

    await OffsiteAssignmentModel.updateByIdAndCompanyId(
      assignmentId,
      companyId,
      cleanData,
    );
    const updated = await OffsiteAssignmentModel.findByIdAndCompanyId(
      assignmentId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "UPDATE",
        table: "offsite_assignments",
        recordId: Number(assignmentId),
        oldVal: oldRecord,
        newVal: updated,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 offsite update):", error);
    }

    return updated;
  }

  async deleteAssignment(user, assignmentId, ipAddress) {
    const companyId = user.company_id;
    const oldRecord = await OffsiteAssignmentModel.findByIdAndCompanyId(
      assignmentId,
      companyId,
    );

    if (!oldRecord) {
      throw new AppError("ไม่พบข้อมูลงานนอกสถานที่", 404);
    }

    await OffsiteAssignmentModel.deactivateByIdAndCompanyId(
      assignmentId,
      companyId,
    );

    try {
      await auditRecord({
        userId: user.id,
        companyId,
        action: "DELETE",
        table: "offsite_assignments",
        recordId: Number(assignmentId),
        oldVal: oldRecord,
        newVal: null,
        ipAddress,
      });
    } catch (error) {
      console.warn("Audit record failed (v2 offsite delete):", error);
    }
  }
}

module.exports = new OffsiteAssignmentService();
