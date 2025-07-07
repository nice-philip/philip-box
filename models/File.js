const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    folderPath: { type: String, default: '/' },
    firebasePath: { type: String, required: true },
    isImportant: { type: Boolean, default: false },
    isShared: { type: Boolean, default: false },
    shareId: { type: String },
    description: { type: String },
    thumbnailPath: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('File', fileSchema); 