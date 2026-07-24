const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const Bet = require('../models/Bet');
const User = require('../models/User');

// Generate unique 10-digit ticket ID
const generateTicketId = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// ============================================
// USER ROUTES
// ============================================

// Place bet
router.post('/place', protect, async (req, res) => {
  try {
    const { bets, totalStake, totalOdds } = req.body;
    const userId = req.user.id;

    console.log('Place bet request:', { bets, totalStake, totalOdds, userId });

    if (!bets || bets.length === 0) {
      return res.status(400).json({ success: false, message: 'No selections provided' });
    }

    if (!totalStake || totalStake <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid stake amount' });
    }

    // Check user balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.wallet || user.wallet.balance < totalStake) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient balance. Available: ETB ${user.wallet?.balance || 0}` 
      });
    }

    // Calculate potential win
    const potentialWin = totalStake * totalOdds;

    // Generate unique ticket ID
    const ticketId = generateTicketId();

    // Create bet with ticket ID
    const bet = new Bet({
      user: userId,
      ticketId: ticketId,
      selections: bets.map(b => ({
        matchId: b.matchId,
        match: b.match,
        league: b.league,
        betType: b.betType,
        market: b.market || 'Result',
        odds: b.odds,
        status: 'pending'
      })),
      totalStake: totalStake,
      totalOdds: totalOdds,
      potentialWin: potentialWin,
      status: 'pending',
      result: 'pending'
    });

    await bet.save();
    console.log(`Bet placed successfully: ${bet._id} | Ticket: ${ticketId}`);

    // Deduct from user balance
    user.wallet.balance -= totalStake;
    await user.save();

    // Return bet with ticket ID
    const populatedBet = await Bet.findById(bet._id).populate('user', 'username email');

    res.json({
      success: true,
      message: 'Bet placed successfully',
      bet: populatedBet,
      ticketId: ticketId
    });
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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
      .select('ticketId selections totalStake totalOdds potentialWin status result createdAt settledAt adminNotes')
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

    // Check if user owns this bet or is admin
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
      .select('ticketId user selections totalStake totalOdds potentialWin status result createdAt settledAt adminNotes')
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

    // Update selection status
    bet.selections[idx].status = status;
    await bet.save();

    // Check if all selections are settled
    const allSettled = bet.selections.every(s => s.status !== 'pending');
    
    if (allSettled) {
      // Determine overall bet result
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

        // Update user balance based on final result
        const user = await User.findById(bet.user);
        if (user) {
          if (finalStatus === 'won') {
            // Credit winnings
            user.wallet.balance += bet.potentialWin;
            await user.save();
            console.log(`✅ Bet ${bet._id} (Ticket: ${bet.ticketId}) WON! Credited ETB ${bet.potentialWin} to ${user.username}`);
          } else if (finalStatus === 'lost') {
            // No refund on loss - stake already deducted
            console.log(`❌ Bet ${bet._id} (Ticket: ${bet.ticketId}) LOST! Stake ETB ${bet.totalStake} was already deducted`);
          }
        }

        await bet.save();
      }
    }

    // Get updated bet with populated user
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

// Update entire bet status (admin) - Simple Won/Lost per ticket
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

    // If bet is already settled, prevent changes
    if (bet.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot change status from ${bet.status}` 
      });
    }

    // Update bet status
    bet.status = status;
    bet.result = status;
    bet.settledAt = new Date();
    bet.settledBy = adminId;
    if (adminNotes) {
      bet.adminNotes = adminNotes;
    }

    // Also update all selections to match
    bet.selections.forEach(sel => {
      if (sel.status === 'pending') {
        sel.status = status === 'won' ? 'won' : 'lost';
      }
    });

    await bet.save();

    // Handle balance changes
    const user = await User.findById(bet.user);
    if (user) {
      if (status === 'won') {
        // Credit winnings ONLY when WON
        user.wallet.balance += bet.potentialWin;
        await user.save();
        console.log(`✅ Bet ${bet._id} (Ticket: ${bet.ticketId}) WON! Credited ETB ${bet.potentialWin} to ${user.username}`);
      } else if (status === 'lost') {
        // NO REFUND - stake was already deducted when bet was placed
        console.log(`❌ Bet ${bet._id} (Ticket: ${bet.ticketId}) LOST! No refund. Stake ETB ${bet.totalStake} already deducted.`);
      } else if (status === 'cancelled') {
        // REFUND only for cancelled bets
        user.wallet.balance += bet.totalStake;
        await user.save();
        console.log(`🚫 Bet ${bet._id} (Ticket: ${bet.ticketId}) CANCELLED! Refunded ETB ${bet.totalStake} to ${user.username}`);
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

    // Total stake and winnings
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
      
      // Update selections
      bet.selections.forEach(sel => {
        if (sel.status === 'pending') {
          sel.status = status === 'won' ? 'won' : 'lost';
        }
      });
      
      await bet.save();

      // Handle balance changes
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