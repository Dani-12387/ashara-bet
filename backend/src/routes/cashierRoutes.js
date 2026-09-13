const express = require('express');
const router = express.Router();
const cashierController = require('../controllers/cashierController');
const { protect, isAdmin, isCashier } = require('../middleware/auth');

// CASHIER-ONLY ROUTES
router.post('/deposit', protect, isCashier, cashierController.cashierCreateDeposit);
router.post('/withdraw', protect, isCashier, cashierController.cashierCreateWithdrawal);
router.post('/add-user', protect, isCashier, cashierController.cashierAddUser);
router.get('/report', protect, isCashier, cashierController.cashierReport);
router.get('/lookup', protect, isCashier, cashierController.cashierLookupUser);

// ADMIN-ONLY ROUTES (for managing cashiers)
router.post('/admin/assign', protect, isAdmin, cashierController.adminAssignCashier);
router.post('/admin/remove', protect, isAdmin, cashierController.adminRemoveCashier);
router.get('/admin/cashiers', protect, isAdmin, cashierController.adminListCashiers);
router.get('/admin/candidates', protect, isAdmin, cashierController.adminListCandidateUsers);

module.exports = router;