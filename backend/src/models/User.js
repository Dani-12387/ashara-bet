const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'user', 'cashier', 'manager', 'support'],
        default: 'user'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    profile: {
        firstName: String,
        lastName: String,
        dateOfBirth: Date,
        address: {
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String
        }
    },
    kyc: {
        status: {
            type: String,
            enum: ['pending', 'verified', 'rejected', 'not_submitted'],
            default: 'not_submitted'
        },
        documents: [{
            type: String,
            fileUrl: String,
            uploadedAt: Date,
            verifiedAt: Date
        }]
    },

    // =====================================================
    // ✅ WALLET — Real balance starts at 0, bonus starts at 20
    // =====================================================
    wallet: {
        balance: {
            type: Number,
            default: 0            // ✅ Real balance
        },
        bonusBalance: {
            type: Number,
            default: 20           // ✅ Bonus balance
        },
        lockedBalance: {
            type: Number,
            default: 0
        },
        welcomeBonusClaimed: {
            type: Boolean,
            default: true
        }
    },

    // ✅ REFERRAL FIELDS
    referralCode: {
        type: String,
        unique: true,
        uppercase: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    referrals: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    referralEarnings: {
        type: Number,
        default: 0
    },

    // ✅ CASHIER TRACKING
    cashierInfo: {
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        assignedAt: {
            type: Date,
            default: null
        },
        totalDepositsProcessed: {
            type: Number,
            default: 0
        },
        totalWithdrawalsProcessed: {
            type: Number,
            default: 0
        },
        totalUsersCreated: {
            type: Number,
            default: 0
        },
        lastActivity: {
            type: Date,
            default: null
        }
    },

    // Login tracking
    lastLogin: {
        type: Date
    },
    loginCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// =====================================================
// ✅ PRE-SAVE HOOK — Fixed to match the schema
// Real balance = 0, Bonus balance = 20
// =====================================================
userSchema.pre('save', async function(next) {
    // Generate unique referral code
    if (this.isNew || !this.referralCode) {
        let code;
        let exists = true;
        let attempts = 0;
        const User = mongoose.model('User');

        while (exists && attempts < 10) {
            code = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
            const existing = await User.findOne({ referralCode: code });
            if (!existing) exists = false;
            attempts++;
        }
        if (!exists) {
            this.referralCode = code;
        } else {
            this.referralCode = 'REF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 4).toUpperCase();
        }
    }

    // ✅ CORRECTED WALLET DEFAULTS:
    // Real balance = 0 (deposits only)
    // Bonus balance = 20 (welcome bonus, restricted)
    if (this.isNew) {
        this.wallet = this.wallet || {};
        this.wallet.balance = 0;                // ✅ FIXED — was 20
        this.wallet.bonusBalance = 20;           // ✅ FIXED — was 0
        this.wallet.lockedBalance = 0;
        this.wallet.welcomeBonusClaimed = true;
        this.loginCount = 0;
    }

    next();
});

// ✅ Update login timestamp
userSchema.methods.updateLogin = function() {
    this.lastLogin = new Date();
    this.loginCount = (this.loginCount || 0) + 1;
    return this.save();
};

// ✅ Check if user is cashier
userSchema.methods.isCashier = function() {
    return this.role === 'cashier';
};

// ✅ Check if user is admin
userSchema.methods.isAdmin = function() {
    return this.role === 'admin';
};

// ✅ Check if user can access cashier features (cashier OR admin)
userSchema.methods.canUseCashier = function() {
    return this.role === 'cashier' || this.role === 'admin';
};

// ✅ Total available balance
userSchema.methods.getTotalBalance = function() {
    return (this.wallet?.balance || 0) + (this.wallet?.bonusBalance || 0);
};

module.exports = mongoose.model('User', userSchema);