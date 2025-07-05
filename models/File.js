const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    originalName: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    extension: {
        type: String,
        required: function() { return !this.isFolder; }
    },
    isFolder: {
        type: Boolean,
        default: false
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
        default: null
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Firebase Storage specific fields
    firebaseStoragePath: {
        type: String,
        required: function() { return !this.isFolder; }
    },
    firebaseDownloadUrl: {
        type: String,
        required: function() { return !this.isFolder; }
    },
    // File metadata
    metadata: {
        width: Number,
        height: Number,
        duration: Number,
        bitrate: Number,
        createdBy: String,
        lastModifiedBy: String,
        tags: [String],
        description: String
    },
    // Permissions and sharing
    permissions: {
        public: {
            type: Boolean,
            default: false
        },
        shared: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            email: String,
            permission: {
                type: String,
                enum: ['read', 'write', 'admin'],
                default: 'read'
            },
            sharedAt: {
                type: Date,
                default: Date.now
            }
        }],
        shareLink: {
            token: String,
            expiresAt: Date,
            password: String,
            downloadCount: {
                type: Number,
                default: 0
            }
        }
    },
    // Version control
    version: {
        type: Number,
        default: 1
    },
    versions: [{
        version: Number,
        firebaseStoragePath: String,
        size: Number,
        modifiedAt: Date,
        modifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    // Status and flags
    status: {
        type: String,
        enum: ['active', 'deleted', 'archived'],
        default: 'active'
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    isStarred: {
        type: Boolean,
        default: false
    },
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    lastAccessedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for better performance
fileSchema.index({ ownerId: 1, isDeleted: 1, status: 1 });
fileSchema.index({ parentId: 1, isDeleted: 1 });
fileSchema.index({ name: 'text', originalName: 'text' });
fileSchema.index({ firebaseStoragePath: 1 });
fileSchema.index({ 'permissions.shareLink.token': 1 });
fileSchema.index({ createdAt: -1 });

// Virtual for file URL
fileSchema.virtual('url').get(function() {
    return this.firebaseDownloadUrl || `/api/files/${this._id}/download`;
});

// Method to get file tree structure
fileSchema.statics.getFileTree = async function(userId, parentId = null) {
    const files = await this.find({
        ownerId: userId,
        parentId: parentId,
        isDeleted: false,
        status: 'active'
    }).sort({ isFolder: -1, name: 1 });

    const tree = [];
    for (const file of files) {
        const fileObj = file.toObject();
        if (file.isFolder) {
            fileObj.children = await this.getFileTree(userId, file._id);
        }
        tree.push(fileObj);
    }
    return tree;
};

// Method to get file breadcrumb path
fileSchema.methods.getBreadcrumb = async function() {
    const breadcrumb = [];
    let current = this;
    
    while (current && current.parentId) {
        const parent = await this.constructor.findById(current.parentId);
        if (parent) {
            breadcrumb.unshift({
                _id: parent._id,
                name: parent.name,
                isFolder: parent.isFolder
            });
            current = parent;
        } else {
            break;
        }
    }
    
    return breadcrumb;
};

// Method to check if user has permission
fileSchema.methods.hasPermission = function(userId, permission = 'read') {
    // Owner has all permissions
    if (this.ownerId.toString() === userId.toString()) {
        return true;
    }
    
    // Check if file is public
    if (this.permissions.public && permission === 'read') {
        return true;
    }
    
    // Check shared permissions
    const sharedPermission = this.permissions.shared.find(
        share => share.userId && share.userId.toString() === userId.toString()
    );
    
    if (sharedPermission) {
        const permissionLevels = ['read', 'write', 'admin'];
        const userLevel = permissionLevels.indexOf(sharedPermission.permission);
        const requiredLevel = permissionLevels.indexOf(permission);
        return userLevel >= requiredLevel;
    }
    
    return false;
};

// Method to get total size of folder
fileSchema.methods.getFolderSize = async function() {
    if (!this.isFolder) {
        return this.size;
    }
    
    const result = await this.constructor.aggregate([
        {
            $match: {
                path: new RegExp(`^${this.path}/`),
                isDeleted: false,
                isFolder: false
            }
        },
        {
            $group: {
                _id: null,
                totalSize: { $sum: '$size' }
            }
        }
    ]);
    
    return result.length > 0 ? result[0].totalSize : 0;
};

// Method to move file to trash
fileSchema.methods.moveToTrash = async function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.status = 'deleted';
    await this.save();
};

// Method to restore from trash
fileSchema.methods.restore = async function() {
    this.isDeleted = false;
    this.deletedAt = null;
    this.status = 'active';
    await this.save();
};

// Method to permanently delete
fileSchema.methods.permanentDelete = async function() {
    // Delete all children if folder
    if (this.isFolder) {
        await this.constructor.deleteMany({
            path: new RegExp(`^${this.path}/`)
        });
    }
    
    // Delete from Firebase Storage if file
    if (!this.isFolder && this.firebaseStoragePath) {
        // This would be handled by the service layer
        // Firebase Storage deletion logic would go here
        const { getStorageBucket } = require('../firebase-config');
        try {
            const bucket = getStorageBucket();
            const file = bucket.file(this.firebaseStoragePath);
            await file.delete();
        } catch (error) {
            console.error('Error deleting file from Firebase Storage:', error);
        }
    }
    
    await this.deleteOne();
};

// Method to create share link
fileSchema.methods.createShareLink = function(options = {}) {
    const token = require('crypto').randomBytes(32).toString('hex');
    this.permissions.shareLink = {
        token,
        expiresAt: options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        password: options.password || null,
        downloadCount: 0
    };
    return token;
};

// Pre-save middleware
fileSchema.pre('save', function(next) {
    if (this.isModified('name') || this.isModified('parentId')) {
        // Update path when name or parent changes
        this.path = this.parentId ? `${this.parent.path}/${this.name}` : this.name;
    }
    next();
});

// Post-save middleware for updating user storage
fileSchema.post('save', async function(doc) {
    if (doc.isNew && !doc.isFolder) {
        const User = require('./User');
        await User.findByIdAndUpdate(doc.ownerId, {
            $inc: { 'storage.used': doc.size }
        });
    }
});

// Post-remove middleware for updating user storage
fileSchema.post('deleteOne', { document: true }, async function(doc) {
    if (!doc.isFolder) {
        const User = require('./User');
        await User.findByIdAndUpdate(doc.ownerId, {
            $inc: { 'storage.used': -doc.size }
        });
    }
});

module.exports = mongoose.model('File', fileSchema); 