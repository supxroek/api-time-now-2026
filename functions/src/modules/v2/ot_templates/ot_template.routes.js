const express = require("express");
const controller = require("./ot_template.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/ot-templates/overview
  .route("/overview")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getOverview);

router
  // Endpoint: GET /api/v2/ot-templates
  .route("/")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getAll)
  .post(restrictTo("super_admin", "admin"), controller.create);

router
  // Endpoint: GET /api/v2/ot-templates/:id
  .route("/:id")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getOne)
  .patch(restrictTo("super_admin", "admin"), controller.update)
  .delete(restrictTo("super_admin", "admin"), controller.delete);

router
  // Endpoint: PATCH /api/v2/ot-templates/:id/restore
  .route("/:id/restore")
  .patch(restrictTo("super_admin", "admin"), controller.restore);

module.exports = router;
