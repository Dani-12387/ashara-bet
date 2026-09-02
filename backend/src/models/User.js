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
        enum: ['admin', 'user', 'manager', 'support'],
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
    wallet: {
        balance: {
            type: Number,
            default: 20
        },
        bonusBalance: {
            type: Number,
            default: 0
        },
        lockedBalance: {
            type: Number,
            default: 0
        },
        welcomeBonusClaimed: {
            type: Boolean,
            default: false
        }
    },
    // ✅ REFERRAL FIELDS – add these
    referralCode: {
        type: String,
        unique: true,
        required: true,
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
    // login tracking
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

// ✅ Generate unique referral code before saving
userSchema.pre('save', async function(next) {
    // Only generate if new or referralCode is empty
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
            // Fallback: use timestamp + random
            this.referralCode = 'REF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 4).toUpperCase();
        }
    }
    
    // Set wallet default for new users
    if (this.isNew) {
        this.wallet = this.wallet || {};
        this.wallet.balance = 20;
        this.wallet.bonusBalance = 0;
        this.wallet.lockedBalance = 0;
        this.wallet.welcomeBonusClaimed = true;
        this.loginCount = 0;
    }
    next();
});

// ✅ Method to claim welcome bonus
userSchema.methods.claimWelcomeBonus = function() {
    if (!this.wallet.welcomeBonusClaimed) {
        this.wallet.balance += 10;
        this.wallet.bonusBalance += 10;
        this.wallet.welcomeBonusClaimed = true;
        return true;
    }
    return false;
};

// ✅ Method to update login
userSchema.methods.updateLogin = function() {
    this.lastLogin = new Date();
    this.loginCount = (this.loginCount || 0) + 1;
    return this.save();
};

module.exports = mongoose.model('User', userSchema);