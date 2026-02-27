const express = require("express");
const controller = require("./user.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// User Routes (เฉพาะ Super Admin และ Admin เท่านั้น)
router.route("/").get(restrictTo("super_admin", "admin"), controller.getAll);

router
  .route("/:id/role")
  .patch(restrictTo("super_admin", "admin"), controller.updateRole);

router
  .route("/:id/toggle-status")
  .patch(restrictTo("super_admin", "admin"), controller.toggleStatus);

module.exports = router;
