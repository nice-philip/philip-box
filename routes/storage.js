const express = require('express');
const User = require('../models/User');
const File = require('../models/File');
const auth = require('../middleware/auth');

const router = express.Router();

// Get storage usage
router.get('/usage', auth, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Get detailed storage breakdown
        const storageBreakdown = await File.aggregate([
            {
                $match: {
                    ownerId: user._id,
                    isDeleted: false,
                    isFolder: false
                }
            },
            {
                $group: {
                    _id: '$mimeType',
                    totalSize: { $sum: '$size' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { totalSize: -1 }
            }
        ]);

        // Get folder sizes
        const folderSizes = await File.aggregate([
            {
                $match: {
                    ownerId: user._id,
                    isDeleted: false,
                    isFolder: true
                }
            },
            {
                $lookup: {
                    from: 'files',
                    let: { folderPath: '$path' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$ownerId', user._id] },
                                        { $eq: ['$isDeleted', false] },
                                        { $eq: ['$isFolder', false] },
                                        { $regexMatch: { input: '$path', regex: { $concat: ['^', '$$folderPath', '/'] } } }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'files'
                }
            },
            {
                $project: {
                    name: 1,
                    path: 1,
                    totalSize: { $sum: '$files.size' },
                    fileCount: { $size: '$files' }
                }
            },
            {
                $sort: { totalSize: -1 }
            }
        ]);

        res.json({
            used: user.storage.used,
            total: user.storage.quota,
            available: user.getRemainingStorage(),
            usagePercentage: user.storage.usagePercentage,
            breakdown: storageBreakdown,
            folders: folderSizes,
            lastUpdated: user.storage.lastUpdated
        });

    } catch (error) {
        console.error('Get storage usage error:', error);
        res.status(500).json({
            message: 'Failed to get storage usage',
            error: error.message
        });
    }
});

// Update storage quota (admin only)
router.put('/quota', auth, async (req, res) => {
    try {
        const { quota } = req.body;
        const userId = req.user.userId;

        // Check if user is admin
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                message: 'Admin access required'
            });
        }

        // Update quota
        user.storage.quota = quota;
        user.storage.lastUpdated = new Date();
        await user.save();

        res.json({
            message: 'Storage quota updated successfully',
            quota: user.storage.quota
        });

    } catch (error) {
        console.error('Update storage quota error:', error);
        res.status(500).json({
            message: 'Failed to update storage quota',
            error: error.message
        });
    }
});

// Clean up deleted files (admin only)
router.post('/cleanup', auth, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Check if user is admin
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                message: 'Admin access required'
            });
        }

        // Find deleted files older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const deletedFiles = await File.find({
            isDeleted: true,
            deletedAt: { $lt: thirtyDaysAgo }
        });

        let totalSizeFreed = 0;
        
        for (const file of deletedFiles) {
            if (!file.isFolder) {
                totalSizeFreed += file.size;
            }
            await file.permanentDelete();
        }

        res.json({
            message: 'Cleanup completed successfully',
            filesDeleted: deletedFiles.length,
            spaceFreed: totalSizeFreed
        });

    } catch (error) {
        console.error('Storage cleanup error:', error);
        res.status(500).json({
            message: 'Failed to cleanup storage',
            error: error.message
        });
    }
});

// Get global storage statistics (admin only)
router.get('/stats', auth, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Check if user is admin
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                message: 'Admin access required'
            });
        }

        const stats = await User.getStorageStats();
        
        // Get file statistics
        const fileStats = await File.aggregate([
            {
                $match: {
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: null,
                    totalFiles: { $sum: 1 },
                    totalFolders: { $sum: { $cond: ['$isFolder', 1, 0] } },
                    totalSize: { $sum: '$size' }
                }
            }
        ]);

        res.json({
            users: stats,
            files: fileStats[0] || { totalFiles: 0, totalFolders: 0, totalSize: 0 }
        });

    } catch (error) {
        console.error('Get storage stats error:', error);
        res.status(500).json({
            message: 'Failed to get storage statistics',
            error: error.message
        });
    }
});

module.exports = router; 