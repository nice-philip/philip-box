const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'user' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    storageUsed: { type: Number, default: 0 },
    storageQuota: { type: Number, default: 2 * 1024 * 1024 * 1024 } // 2GB
});

module.exports = mongoose.model('User', userSchema); 