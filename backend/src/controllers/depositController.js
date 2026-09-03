const deposit = new Transaction({
  user: req.user.id,
  type: 'deposit',
  amount: req.body.amount,
  paymentMethod: req.body.paymentMethod,
  transactionReference: req.body.transactionReference,
  screenshot: savedFilename,
  notes: req.body.notes,
  accountName: req.body.accountName || '',
  accountNumber: req.body.accountNumber || ''
});