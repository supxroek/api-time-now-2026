/**
 * /src/modules/overtime/overtime.controller.js
 *
 * Overtime Controller
 * จัดการคำขอที่เกี่ยวกับชั่วโมงทำงานล่วงเวลา
 */

// import services and helpers
const OvertimeService = require("./overtime.service");

// Controller Class
class OvertimeController {
  // GET /api/overtimes
  async getAllOvertimes(req, res) {
    const companyId = req.user.company_id;
    try {
      const overtimes = await OvertimeService.getAllOvertimes(companyId);
      res.status(200).json(overtimes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/overtimes
  async createOvertime(req, res) {
    const companyId = req.user.company_id;
    const overtimeData = req.body;
    try {
      const newOvertime = await OvertimeService.createOvertime(
        overtimeData,
        companyId
      );
      res.status(201).json(newOvertime);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/overtimes/:id
  async updateOvertime(req, res) {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const overtimeData = req.body;
    try {
      const updatedOvertime = await OvertimeService.updateOvertime(
        id,
        overtimeData,
        companyId
      );
      res.status(200).json(updatedOvertime);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/overtimes/:id
  async deleteOvertime(req, res) {
    const companyId = req.user.company_id;
    const { id } = req.params;
    try {
      const result = await OvertimeService.deleteOvertime(id, companyId);
      if (result) {
        res.status(200).json({ message: "Overtime deleted successfully" });
      } else {
        res.status(404).json({ error: "Overtime not found" });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new OvertimeController();
