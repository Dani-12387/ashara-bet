const express = require('express');
const router = express.Router();
const cashierController = require('../controllers/cashierController');
const { protect, isAdmin, isCashier } = require('../middleware/auth');

// =====================================================
// CASHIER ROUTES
// =====================================================
router.post('/deposit', protect, isCashier, cashierController.cashierCreateDeposit);
router.post('/withdraw', protect, isCashier, cashierController.cashierCreateWithdrawal);
router.post('/add-user', protect, isCashier, cashierController.cashierAddUser);
router.get('/report', protect, isCashier, cashierController.cashierReport);
router.get('/lookup', protect, isCashier, cashierController.cashierLookupUser);
router.get('/referral-link', protect, isCashier, cashierController.cashierGetReferralLink);
router.get('/my-referrals', protect, isCashier, cashierController.cashierGetMyReferrals);

// ✅ Referral history (deposits / withdrawals)
router.get('/referral-history/:userId', protect, isCashier, cashierController.cashierGetReferralHistory);

// =====================================================
// ADMIN ROUTES
// =====================================================
router.post('/admin/assign', protect, isAdmin, cashierController.adminAssignCashier);
router.post('/admin/remove', protect, isAdmin, cashierController.adminRemoveCashier);
router.get('/admin/cashiers', protect, isAdmin, cashierController.adminListCashiers);
router.get('/admin/candidates', protect, isAdmin, cashierController.adminListCandidateUsers);
router.get('/admin/cashier/:cashierId/referrals', protect, isAdmin, cashierController.adminGetCashierReferrals);

// ✅ Approval workflow
router.get('/admin/pending-transactions', protect, isAdmin, cashierController.adminListPendingCashierTransactions);
router.post('/admin/approve-deposit/:transactionId', protect, isAdmin, cashierController.adminApproveCashierDeposit);
router.post('/admin/reject-deposit/:transactionId', protect, isAdmin, cashierController.adminRejectCashierDeposit);
router.post('/admin/approve-withdrawal/:withdrawalId', protect, isAdmin, cashierController.adminApproveCashierWithdrawal);
router.post('/admin/reject-withdrawal/:withdrawalId', protect, isAdmin, cashierController.adminRejectCashierWithdrawal);

module.exports = router;