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
}

module.exports = new OvertimeController();
