/**
 * /src/modules/organization/org.controller.js
 *
 * Organization Controller
 * ชั้นควบคุมสำหรับการจัดการคำขอที่เกี่ยวกับองค์กร
 */

// import services and helpers
const DepartmentService = require("./department.service");

// Controller Class
class DepartmentController {
  // GET /api/organization/departments
  async getDepartments(req, res) {
    try {
      const companyId = req.user?.company_id;
      const departments = await DepartmentService.getDepartments(companyId);
      res.status(200).json({
        success: true,
        data: departments,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  // POST /api/organization/departments
  async createDepartment(req, res) {
    try {
      const companyId = req.user?.company_id;
      const departmentData = req.body;
      const newDepartment = await DepartmentService.createDepartment(
        companyId,
        departmentData
      );
      res.status(201).json({
        success: true,
        data: newDepartment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  // GET /api/organization/departments/:id
  async getDepartmentById(req, res) {
    try {
      const companyId = req.user?.company_id;
      const departmentId = req.params.id;
      const department = await DepartmentService.getDepartmentById(
        companyId,
        departmentId
      );
      res.status(200).json({
        success: true,
        data: department,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  // PUT /api/organization/departments/:id
  async updateDepartment(req, res) {
    try {
      const companyId = req.user?.company_id;
      const departmentId = req.params.id;
      const updateData = req.body;
      const updatedDepartment = await DepartmentService.updateDepartment(
        companyId,
        departmentId,
        updateData
      );
      res.status(200).json({
        success: true,
        data: updatedDepartment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  // DELETE /api/organization/departments/:id
  async deleteDepartment(req, res) {
    try {
      const companyId = req.user?.company_id;
      const departmentId = req.params.id;
      await DepartmentService.deleteDepartment(companyId, departmentId);
      res.status(200).json({
        success: true,
        message: "Department deleted successfully",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new DepartmentController();
