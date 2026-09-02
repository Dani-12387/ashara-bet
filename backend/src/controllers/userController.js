const getReferralInfo = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId)
            .populate('referrals', 'username email createdAt status');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Map referrals to match frontend expectations
        const referrals = user.referrals.map(ref => ({
            username: ref.username,
            email: ref.email,
            createdAt: ref.createdAt,
            status: ref.status === 'active' ? 'Active' : 'Inactive'
        }));

        res.json({
            success: true,
            referralCode: user.referralCode,
            referrals: referrals
        });
    } catch (error) {
        console.error('Error fetching referral info:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};