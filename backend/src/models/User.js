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
        // ✅ Add welcome bonus tracking
        welcomeBonusClaimed: {
            type: Boolean,
            default: false
        }
    },
    // ✅ Add login tracking
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

// ✅ Pre-save hook to set welcome bonus
userSchema.pre('save', function(next) {
    // Set balance for new users
    if (this.isNew) {
        this.wallet = this.wallet || {};
        this.wallet.balance = 20; // Default balance
        this.wallet.bonusBalance = 0;
        this.wallet.lockedBalance = 0;
        this.wallet.welcomeBonusClaimed = true;
        this.loginCount = 0;
    }
    next();
});

// ✅ Method to add welcome bonus (if you want to give extra bonus)
userSchema.methods.claimWelcomeBonus = function() {
    if (!this.wallet.welcomeBonusClaimed) {
        this.wallet.balance += 10; // Extra 10 bonus
        this.wallet.bonusBalance += 10;
        this.wallet.welcomeBonusClaimed = true;
        return true;
    }
    return false;
};

// ✅ Method to update last login
userSchema.methods.updateLogin = function() {
    this.lastLogin = new Date();
    this.loginCount = (this.loginCount || 0) + 1;
    return this.save();
};

module.exports = mongoose.model('User', userSchema);