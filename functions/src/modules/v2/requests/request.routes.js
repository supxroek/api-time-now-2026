const express = require("express");
const controller = require("./request.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

// Public token routes for approval via email link
router.get("/approval/validate", controller.validateApprovalToken);
router.post("/approval/approve", controller.approveByToken);
router.post("/approval/reject", controller.rejectByToken);

router.use(protect);

router
  .route("/stats")
  .get(restrictTo("super_admin", "admin"), controller.getStats);

router
  // Endpoint: GET /api/v2/requests
  .route("/")
  .get(restrictTo("super_admin", "admin"), controller.getList);

router
  // Endpoint: GET /api/v2/requests/:id
  .route("/:id")
  .get(restrictTo("super_admin", "admin"), controller.getOne);

router
  // Endpoint: POST /api/v2/requests/:id/resend-notification
  .route("/:id/resend-notification")
  .post(restrictTo("super_admin", "admin"), controller.resendNotification);

module.exports = router;
