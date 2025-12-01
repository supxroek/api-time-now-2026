/**
 * /src/api/controllers/department.controller.js
 *
 * Department Controller
 * จัดการ request/response สำหรับ Department endpoints
 */

// import services
// const departmentService = require("../services/department.service");

// Controller Class
class DepartmentController {
  // ทดสอบ
  async test(req, res) {
    res.json({
      success: true,
      message: "Department Controller is working!",
    });
  }
}

module.exports = new DepartmentController();
