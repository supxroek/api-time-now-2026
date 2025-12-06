/**
 * /src/modules/shifts/shifts.controller.js
 *
 * Shifts Controller
 * จัดการคำขอที่เกี่ยวกับกะการทำงาน
 */

// import services and helpers
const ShiftService = require("./shifts.service");

// Controller Class
class ShiftController {
  // GET /api/shifts
  async getAllShifts(req, res) {
    const companyId = req.user.company_id;
    try {
      const shifts = await ShiftService.getAllShifts(companyId);
      res.status(200).json(shifts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/shifts
  async createShift(req, res) {
    const companyId = req.user.company_id;
    const shiftData = req.body;
    try {
      const newShift = await ShiftService.createShift(shiftData, companyId);
      res.status(201).json(newShift);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // PATCH /api/shifts/:id
  async updateShift(req, res) {
    const companyId = req.user.company_id;
    const shiftId = req.params.id;
    const shiftData = req.body;
    try {
      const updatedShift = await ShiftService.updateShift(
        shiftId,
        shiftData,
        companyId
      );
      res.status(200).json(updatedShift);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/shifts/assign
  async assignShiftToEmployee(req, res) {
    const companyId = req.user.company_id;
    const assignmentData = req.body;
    try {
      const assignment = await ShiftService.assignShiftToEmployee(
        assignmentData,
        companyId
      );
      res.status(200).json(assignment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ShiftController();
