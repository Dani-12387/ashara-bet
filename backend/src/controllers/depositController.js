// When creating a deposit
const deposit = new Transaction({
  user: req.user.id,
  type: 'deposit',
  amount: req.body.amount,
  paymentMethod: req.body.paymentMethod,
  transactionReference: req.body.transactionReference,
  screenshot: savedFilename, // after multer upload
  notes: req.body.notes,
  // ✅ Save account info
  accountName: req.body.accountName || '',
  accountNumber: req.body.accountNumber || ''
});
await deposit.save();