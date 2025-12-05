/**
 * /src/modules/employees/employee.controller.js
 *
 * Employees Controller
 * ชั้นควบคุมสำหรับการจัดการคำขอที่เกี่ยวข้องกับพนักงาน
 */

// import services and helpers
const EmployeeService = require("./employee.service");

// Controller Class
class EmployeeController {
  // GET /api/company/employees
  async getEmployees(req, res, next) {
    try {
      const companyId = req.user?.company_id;
      const employees = await EmployeeService.getEmployees(companyId);
      res.status(200).json({
        success: true,
        data: employees,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/company/employees
  async createEmployee(req, res, next) {
    try {
      const companyId = req.user?.company_id;
      const employeeData = req.body;
      const newEmployee = await EmployeeService.createEmployee(
        companyId,
        employeeData
      );
      res.status(201).json({
        success: true,
        data: newEmployee,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/company/employees/:id
  async getEmployeeById(req, res, next) {
    try {
      const companyId = req.user?.company_id;
      const employeeId = req.params.id;
      const employee = await EmployeeService.getEmployeeById(
        companyId,
        employeeId
      );
      res.status(200).json({
        success: true,
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/company/employees/:id
  async updateEmployee(req, res, next) {
    try {
      const companyId = req.user?.company_id;
      const employeeId = req.params.id;
      const updateData = req.body;
      const updatedEmployee = await EmployeeService.updateEmployee(
        companyId,
        employeeId,
        updateData
      );
      res.status(200).json({
        success: true,
        data: updatedEmployee,
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/company/employees/:id/resign
  async resignEmployee(req, res, next) {
    try {
      const companyId = req.user?.company_id;
      const employeeId = req.params.id;
      const resignDate = req.body.resign_date;
      await EmployeeService.resignEmployee(companyId, employeeId, resignDate);
      res.status(200).json({
        success: true,
        message: "Employee resigned successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/company/employees/import
  // รองรับทั้ง JSON body และไฟล์ Excel (XLS/XLSX)
  async importEmployees(req, res, next) {
    try {
      const companyId = req.user?.company_id;
      // ส่งข้อมูลทั้งหมดไปให้ service จัดการ
      const result = EmployeeService.importEmployees({
        companyId,
        file: req.file,
        body: req.body,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EmployeeController();
