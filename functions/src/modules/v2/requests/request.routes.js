const express = require("express");
const controller = require("./request.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  .route("/stats")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getStats);

router
    // Endpoint: GET /api/v2/requests
  .route("/")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getList);

router
    // Endpoint: GET /api/v2/requests/:id
  .route("/:id")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getOne);

module.exports = router;
