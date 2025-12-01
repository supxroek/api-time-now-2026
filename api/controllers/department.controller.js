/**
 * /api/controllers/department.controller.js
 *
 * Department Controller
 * จัดการ request/response สำหรับ Department endpoints
 */

const departmentService = require("../services/department.service");

class DepartmentController {
  /**
   * GET /departments
   * ดึงรายชื่อแผนกทั้งหมดพร้อมจำนวนพนักงาน
   */
  async getAll(req, res, next) {
    try {
      const companyId = req.companyId;

      const departments = await departmentService.getAllWithEmployeeCount(
        companyId
      );

      res.json({
        success: true,
        data: departments,
        total: departments.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /departments/:id
   * ดึงข้อมูลแผนกตาม ID
   */
  async getById(req, res, next) {
    try {
      const companyId = req.companyId;
      const departmentId = parseInt(req.params.id, 10);

      const department = await departmentService.getById(
        companyId,
        departmentId
      );

      res.json({
        success: true,
        data: department,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /departments
   * สร้างแผนกใหม่
   */
  async create(req, res, next) {
    try {
      const companyId = req.companyId;
      const data = req.body;

      const department = await departmentService.create(companyId, data);

      res.status(201).json({
        success: true,
        message: "Department created successfully",
        data: department,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /departments/:id
   * แก้ไขแผนก
   */
  async update(req, res, next) {
    try {
      const companyId = req.companyId;
      const departmentId = parseInt(req.params.id, 10);
      const data = req.body;

      const department = await departmentService.update(
        companyId,
        departmentId,
        data
      );

      res.json({
        success: true,
        message: "Department updated successfully",
        data: department,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /departments/:id
   * ลบแผนก
   */
  async delete(req, res, next) {
    try {
      const companyId = req.companyId;
      const departmentId = parseInt(req.params.id, 10);
      const { force, transferTo } = req.query;

      const result = await departmentService.delete(companyId, departmentId, {
        force: force === "true",
        transferTo: transferTo ? parseInt(transferTo, 10) : null,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DepartmentController();
