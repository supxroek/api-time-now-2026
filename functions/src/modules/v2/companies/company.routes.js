const express = require("express");
const companyController = require("./company.controller");
const { protect, restrictTo } = require("../../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router
  // Endpoint: GET /api/v2/companies/overview
  .route("/overview")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    companyController.getOverview,
  );

router
  // Endpoint: GET /api/v2/companies/profile
  .route("/profile")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    companyController.getProfile,
  )
  .patch(restrictTo("super_admin", "admin"), companyController.updateProfile);

module.exports = router;
