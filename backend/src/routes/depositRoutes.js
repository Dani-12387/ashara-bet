const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'deposit-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Create deposit request
router.post('/create', protect, upload.single('screenshot'), async (req, res) => {
  try {
    const { amount, paymentMethod, transactionReference, notes } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({ message: 'Minimum deposit amount is ETB 10' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Screenshot is required' });
    }

    const transaction = await Transaction.create({
      user: req.user.id,
      type: 'deposit',
      amount: parseFloat(amount),
      paymentMethod,
      transactionReference,
      screenshot: req.file.filename,
      notes,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Deposit request submitted successfully',
      transaction
    });
  } catch (error) {
    console.error('Error creating deposit:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user's recent deposits
router.get('/recent', protect, async (req, res) => {
  try {
    const deposits = await Transaction.find({
      user: req.user.id,
      type: 'deposit'
    }).sort('-createdAt').limit(10);
    
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;