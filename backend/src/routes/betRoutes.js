const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const Bet = require('../models/Bet');
const User = require('../models/User');

// ✅ Import the bet controller (which uses bonusHelper)
const betController = require('../controllers/betController');

// ============================================
// USER ROUTES
// ============================================

// ✅ Place bet — now uses the controller with full bonus support
router.post('/place', protect, betController.placeBets);

// Get user's bet history
router.get('/history', protect, async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const userId = req.user.id;

    const query = { user: userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const bets = await Bet.find(query)
      .select('ticketId selections totalStake totalOdds potentialWin status result createdAt settledAt adminNotes fundedBy bonusPortion realPortion')
      .sort({ createdAt: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Bet.countDocuments(query);

    res.json({
      success: true,
      bets,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching bet history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single bet details
router.get('/:id', protect, async (req, res) => {
  try {
    const bet = await Bet.findById(req.params.id)
      .populate('user', 'username email')
      .select('ticketId user selections totalStake totalOdds potentialWin status result createdAt settledAt adminNotes');

    if (!bet) {
      return res.status(404).json({ success: false, message: 'Bet not found' });
    }

    if (bet.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    res.json({ success: true, bet });
  } catch (error) {
    console.error('Error fetching bet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get all bets (admin)
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const bets = await Bet.find(query)
      .populate('user', 'username email')
      .populate('selections.matchId', 'homeTeam awayTeam')
      .select('ticketId user selections totalStake totalOdds potentialWin status result createdAt settledAt adminNotes fundedBy bonusPortion realPortion')
      .sort({ createdAt: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Bet.countDocuments(query);

    res.json({
      success: true,
      bets,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching admin bets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update individual selection status (admin)
router.put('/admin/:betId/selection/:selectionIndex', protect, authorize('admin'), async (req, res) => {
  try {
    const { betId, selectionIndex } = req.params;
    const { status } = req.body;

    if (!['pending', 'won', 'lost'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid selection status' });
    }

    const bet = await Bet.findById(betId);
    if (!bet) {
      return res.status(404).json({ success: false, message: 'Bet not found' });
    }

    const idx = parseInt(selectionIndex);
    if (idx < 0 || idx >= bet.selections.length) {
      return res.status(400).json({ success: false, message: 'Invalid selection index' });
    }

    bet.selections[idx].status = status;
    await bet.save();

    const allSettled = bet.selections.every(s => s.status !== 'pending');

    if (allSettled) {
      const allWon = bet.selections.every(s => s.status === 'won');
      const anyLost = bet.selections.some(s => s.status === 'lost');

      let finalStatus = 'pending';
      if (allWon && !anyLost) {
        finalStatus = 'won';
      } else if (anyLost) {
        finalStatus = 'lost';
      }

      if (finalStatus !== 'pending') {
        bet.status = finalStatus;
        bet.result = finalStatus;
        bet.settledAt = new Date();
        bet.settledBy = req.user.id;

        const user = await User.findById(bet.user);
        if (user) {
          if (finalStatus === 'won') {
            user.wallet.balance += bet.potentialWin;
            await user.save();
            console.log(`✅ Bet ${bet._id} WON! Credited ETB ${bet.potentialWin}`);
          } else {
            console.log(`❌ Bet ${bet._id} LOST! Stake already deducted`);
          }
        }
        await bet.save();
      }
    }

    const updatedBet = await Bet.findById(betId)
      .populate('user', 'username email')
      .select('ticketId user selections totalStake totalOdds potentialWin status result createdAt settledAt adminNotes');

    res.json({
      success: true,
      message: `Selection ${idx + 1} marked as ${status}`,
      bet: updatedBet
    });
  } catch (error) {
    console.error('Error updating selection:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update entire bet status (admin)
router.put('/admin/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const betId = req.params.id;
    const adminId = req.user.id;

    if (!['pending', 'won', 'lost', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const bet = await Bet.findById(betId);
    if (!bet) {
      return res.status(404).json({ success: false, message: 'Bet not found' });
    }

    if (bet.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${bet.status}`
      });
    }

    bet.status = status;
    bet.result = status;
    bet.settledAt = new Date();
    bet.settledBy = adminId;
    if (adminNotes) {
      bet.adminNotes = adminNotes;
    }

    bet.selections.forEach(sel => {
      if (sel.status === 'pending') {
        sel.status = status === 'won' ? 'won' : 'lost';
      }
    });

    await bet.save();

    const user = await User.findById(bet.user);
    if (user) {
      if (status === 'won') {
        user.wallet.balance += bet.potentialWin;
        await user.save();
        console.log(`✅ Bet ${bet._id} WON! Credited ETB ${bet.potentialWin}`);
      } else if (status === 'lost') {
        console.log(`❌ Bet ${bet._id} LOST!`);
      } else if (status === 'cancelled') {
        user.wallet.balance += bet.totalStake;
        await user.save();
        console.log(`🚫 Bet ${bet._id} CANCELLED! Refunded ETB ${bet.totalStake}`);
      }
    }

    const updatedBet = await Bet.findById(betId)
      .populate('user', 'username email')
      .select('ticketId user selections totalStake totalOdds potentialWin status result createdAt settledAt adminNotes');

    res.json({
      success: true,
      message: `Bet ${status} successfully`,
      bet: updatedBet
    });
  } catch (error) {
    console.error('Error updating bet status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get bet statistics (admin)
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const totalBets = await Bet.countDocuments();
    const pendingBets = await Bet.countDocuments({ status: 'pending' });
    const wonBets = await Bet.countDocuments({ status: 'won' });
    const lostBets = await Bet.countDocuments({ status: 'lost' });
    const cancelledBets = await Bet.countDocuments({ status: 'cancelled' });

    const stats = await Bet.aggregate([
      {
        $group: {
          _id: null,
          totalStake: { $sum: '$totalStake' },
          totalWon: {
            $sum: {
              $cond: [{ $eq: ['$status', 'won'] }, '$potentialWin', 0]
            }
          },
          totalLost: {
            $sum: {
              $cond: [{ $eq: ['$status', 'lost'] }, '$totalStake', 0]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        total: totalBets,
        pending: pendingBets,
        won: wonBets,
        lost: lostBets,
        cancelled: cancelledBets,
        totalStake: stats[0]?.totalStake || 0,
        totalWon: stats[0]?.totalWon || 0,
        totalLost: stats[0]?.totalLost || 0,
        profit: (stats[0]?.totalWon || 0) - (stats[0]?.totalLost || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching bet stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk update bet status (admin)
router.post('/admin/bulk-update', protect, authorize('admin'), async (req, res) => {
  try {
    const { betIds, status, adminNotes } = req.body;

    if (!betIds || betIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No bets selected' });
    }

    if (!['pending', 'won', 'lost', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const results = [];
    for (const betId of betIds) {
      const bet = await Bet.findById(betId);
      if (!bet || bet.status !== 'pending') continue;

      bet.status = status;
      bet.result = status;
      bet.settledAt = new Date();
      bet.settledBy = req.user.id;
      if (adminNotes) {
        bet.adminNotes = adminNotes;
      }

      bet.selections.forEach(sel => {
        if (sel.status === 'pending') {
          sel.status = status === 'won' ? 'won' : 'lost';
        }
      });

      await bet.save();

      const user = await User.findById(bet.user);
      if (user) {
        if (status === 'lost' || status === 'cancelled') {
          user.wallet.balance += bet.totalStake;
        } else if (status === 'won') {
          user.wallet.balance += bet.potentialWin;
        }
        await user.save();
      }

      results.push(bet);
    }

    res.json({
      success: true,
      message: `${results.length} bets updated to ${status}`,
      results
    });
  } catch (error) {
    console.error('Error bulk updating bets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;