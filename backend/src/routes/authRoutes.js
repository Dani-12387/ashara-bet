const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  checkPhone,
  checkReferral,
  getReferralInfo
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// =====================================================
// PUBLIC ROUTES
// =====================================================
router.post("/register", register);
router.post("/login", login);
router.post("/check-phone", checkPhone);
router.get("/check-referral/:code", checkReferral); // ✅ NEW — validates referral code

// =====================================================
// PROTECTED ROUTES
// =====================================================
router.get("/me", protect, getMe);
router.get("/referral-info", protect, getReferralInfo); // ✅ NEW — user's own referral info

module.exports = router;