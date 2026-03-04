const RosterManageV1Service = require("../../v1/roster_manage/roster_manage.service");

class RosterManageV2Service {
  async getOverview(companyId, query) {
    return RosterManageV1Service.getOverview(companyId, query);
  }

  async bulkSave(companyId, user, payload, ipAddress) {
    return RosterManageV1Service.bulkSave(companyId, user, payload, ipAddress);
  }
}

module.exports = new RosterManageV2Service();
