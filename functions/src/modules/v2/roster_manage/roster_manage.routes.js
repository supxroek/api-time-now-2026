const express = require("express");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");
const controller = require("./roster_manage.controller");

const router = express.Router();

router.use(protect);

router
  .route("/overview")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getOverview);

router
  .route("/bulk-save")
  .post(restrictTo("super_admin", "admin"), controller.bulkSave);

router
  .route("/bulk-upsert")
  .post(restrictTo("super_admin", "admin"), controller.bulkUpsert);

router
  .route("/bulk-upsert-daytype")
  .post(restrictTo("super_admin", "admin"), controller.bulkUpsertDayType);

router
  .route("/bulk-upsert-shift")
  .post(restrictTo("super_admin", "admin"), controller.bulkUpsertShift);

module.exports = router;
