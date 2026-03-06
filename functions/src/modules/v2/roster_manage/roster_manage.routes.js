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

module.exports = router;
