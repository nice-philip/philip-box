const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't include password in queries by default
    },
    avatar: {
        type: String,
        default: null
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        default: null
    },
    passwordResetToken: {
        type: String,
        default: null
    },
    passwordResetExpires: {
        type: Date,
        default: null
    },
    lastLogin: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    storage: {
        used: {
            type: Number,
            default: 0 // bytes
        },
        quota: {
            type: Number,
            default: 2 * 1024 * 1024 * 1024 // 2GB in bytes
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    preferences: {
        language: {
            type: String,
            default: 'ko'
        },
        timezone: {
            type: String,
            default: 'Asia/Seoul'
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            browser: {
                type: Boolean,
                default: true
            }
        },
        theme: {
            type: String,
            enum: ['light', 'dark', 'auto'],
            default: 'light'
        }
    },
    metadata: {
        totalFiles: {
            type: Number,
            default: 0
        },
        totalFolders: {
            type: Number,
            default: 0
        },
        lastActivity: {
            type: Date,
            default: Date.now
        },
        signupSource: {
            type: String,
            default: 'direct'
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'storage.used': 1 });
userSchema.index({ isActive: 1 });

// Virtual for storage usage percentage
userSchema.virtual('storage.usagePercentage').get(function() {
    return Math.round((this.storage.used / this.storage.quota) * 100);
});

// Virtual for formatted storage sizes
userSchema.virtual('storage.usedFormatted').get(function() {
    return formatBytes(this.storage.used);
});

userSchema.virtual('storage.quotaFormatted').get(function() {
    return formatBytes(this.storage.quota);
});

// Virtual for full name (if we add first/last name later)
userSchema.virtual('fullName').get(function() {
    return this.name;
});

// Virtual for avatar URL
userSchema.virtual('avatarUrl').get(function() {
    if (this.avatar) {
        return this.avatar;
    }
    // Generate avatar based on initials
    const initials = this.name.split(' ').map(n => n[0]).join('').toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0061ff&color=fff`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        // Hash password with cost of 12
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware to update lastActivity
userSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.metadata.lastActivity = new Date();
    }
    next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Instance method to update storage usage
userSchema.methods.updateStorageUsage = async function(sizeChange) {
    try {
        this.storage.used += sizeChange;
        this.storage.lastUpdated = new Date();
        
        // Ensure storage used doesn't go below 0
        if (this.storage.used < 0) {
            this.storage.used = 0;
        }
        
        await this.save();
        return this.storage;
    } catch (error) {
        throw new Error('Failed to update storage usage');
    }
};

// Instance method to check if user has enough storage
userSchema.methods.hasEnoughStorage = function(requiredSize) {
    return (this.storage.used + requiredSize) <= this.storage.quota;
};

// Instance method to get remaining storage
userSchema.methods.getRemainingStorage = function() {
    return Math.max(0, this.storage.quota - this.storage.used);
};

// Instance method to update last login
userSchema.methods.updateLastLogin = async function() {
    try {
        this.lastLogin = new Date();
        await this.save();
    } catch (error) {
        throw new Error('Failed to update last login');
    }
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active users
userSchema.statics.findActive = function() {
    return this.find({ isActive: true });
};

// Static method to get storage statistics
userSchema.statics.getStorageStats = async function() {
    try {
        const stats = await this.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    totalStorageUsed: { $sum: '$storage.used' },
                    totalStorageQuota: { $sum: '$storage.quota' },
                    avgStorageUsed: { $avg: '$storage.used' },
                    maxStorageUsed: { $max: '$storage.used' }
                }
            }
        ]);
        
        return stats[0] || {
            totalUsers: 0,
            totalStorageUsed: 0,
            totalStorageQuota: 0,
            avgStorageUsed: 0,
            maxStorageUsed: 0
        };
    } catch (error) {
        throw new Error('Failed to get storage statistics');
    }
};

// Static method to clean up inactive users
userSchema.statics.cleanupInactiveUsers = async function(daysInactive = 365) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
        
        const result = await this.updateMany(
            { 
                lastLogin: { $lt: cutoffDate },
                isActive: true
            },
            { 
                isActive: false 
            }
        );
        
        return result;
    } catch (error) {
        throw new Error('Failed to cleanup inactive users');
    }
};

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = mongoose.model('User', userSchema); 