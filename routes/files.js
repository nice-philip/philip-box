const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const path = require('path');
const crypto = require('crypto');
const File = require('../models/File');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 10
    }
});

// Get files list
router.get('/', auth, async (req, res) => {
    try {
        const { path = '/', section = 'files' } = req.query;
        const userId = req.user.userId;

        let query = {
            ownerId: userId,
            isDeleted: false
        };

        // Handle different sections
        switch (section) {
            case 'files':
                query.path = path === '/' ? { $regex: /^[^\/]*$/ } : { $regex: new RegExp(`^${path.replace(/\/$/, '')}/[^\/]*$`) };
                break;
            case 'shared':
                query['permissions.shared'] = { $elemMatch: { userId: userId } };
                break;
            case 'recent':
                query.lastAccessedAt = { $exists: true };
                break;
            case 'deleted':
                query.isDeleted = true;
                break;
        }

        const files = await File.find(query)
            .sort({ isFolder: -1, name: 1 })
            .limit(1000);

        res.json({
            files: files.map(file => ({
                id: file._id,
                name: file.name,
                size: file.size,
                type: file.mimeType,
                isFolder: file.isFolder,
                path: file.path,
                createdAt: file.createdAt,
                modifiedAt: file.updatedAt,
                lastAccessedAt: file.lastAccessedAt,
                isStarred: file.isStarred,
                permissions: file.permissions
            }))
        });

    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({
            message: 'Failed to get files',
            error: error.message
        });
    }
});

// Upload file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
    try {
        console.log('Upload request received:', {
            file: req.file ? { name: req.file.originalname, size: req.file.size } : 'No file',
            body: req.body,
            userId: req.user.userId
        });

        const { path: filePath = '/' } = req.body;
        const userId = req.user.userId;

        if (!req.file) {
            console.log('No file provided in request');
            return res.status(400).json({
                message: 'No file provided'
            });
        }

        console.log('Finding user:', userId);
        // Check user storage quota
        const user = await User.findById(userId);
        if (!user) {
            console.error('User not found:', userId);
            return res.status(404).json({
                message: 'User not found'
            });
        }

        console.log('Checking storage quota:', { 
            fileSize: req.file.size, 
            userStorage: user.storage 
        });
        
        if (!user.hasEnoughStorage(req.file.size)) {
            console.log('Storage quota exceeded');
            return res.status(413).json({
                message: 'Storage quota exceeded'
            });
        }

        // Generate unique filename
        const fileExtension = path.extname(req.file.originalname);
        const fileName = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
        const s3Key = `uploads/${userId}/${fileName}`;

        console.log('Uploading to S3:', { 
            bucket: process.env.S3_BUCKET_NAME, 
            key: s3Key,
            size: req.file.size
        });

        // Upload to S3
        const uploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            Metadata: {
                originalName: req.file.originalname,
                uploadedBy: userId.toString()
            }
        };

        const uploadResult = await s3.upload(uploadParams).promise();
        console.log('S3 upload successful:', uploadResult.Location);

        console.log('Creating file record in database');
        // Create file record
        const file = new File({
            name: req.file.originalname,
            originalName: req.file.originalname,
            path: filePath === '/' ? req.file.originalname : `${filePath}/${req.file.originalname}`,
            size: req.file.size,
            mimeType: req.file.mimetype,
            extension: fileExtension.slice(1),
            ownerId: userId,
            s3Key: s3Key,
            s3Bucket: process.env.S3_BUCKET_NAME,
            s3Url: uploadResult.Location
        });

        await file.save();
        console.log('File record saved:', file._id);

        console.log('Updating user storage usage');
        // Update user storage
        await user.updateStorageUsage(req.file.size);
        console.log('User storage updated successfully');

        res.json({
            message: 'File uploaded successfully',
            file: {
                id: file._id,
                name: file.name,
                size: file.size,
                type: file.mimeType,
                path: file.path,
                createdAt: file.createdAt
            }
        });

    } catch (error) {
        console.error('Upload error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            statusCode: error.statusCode
        });
        res.status(500).json({
            message: 'Upload failed',
            error: error.message
        });
    }
});

// Download file
router.get('/download/:fileId', auth, async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.userId;

        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({
                message: 'File not found'
            });
        }

        // Check permissions
        if (!file.hasPermission(userId, 'read')) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        // Generate signed URL for S3 download
        const downloadParams = {
            Bucket: file.s3Bucket,
            Key: file.s3Key,
            Expires: 3600, // 1 hour
            ResponseContentDisposition: `attachment; filename="${file.originalName}"`
        };

        const downloadUrl = s3.getSignedUrl('getObject', downloadParams);

        // Update last accessed time
        file.lastAccessedAt = new Date();
        await file.save();

        res.json({
            downloadUrl: downloadUrl,
            filename: file.originalName,
            size: file.size
        });

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            message: 'Download failed',
            error: error.message
        });
    }
});

// Delete file
router.delete('/delete', auth, async (req, res) => {
    try {
        const { fileId } = req.body;
        const userId = req.user.userId;

        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({
                message: 'File not found'
            });
        }

        // Check permissions
        if (!file.hasPermission(userId, 'write')) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        // Move to trash (soft delete)
        await file.moveToTrash();

        res.json({
            message: 'File moved to trash'
        });

    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            message: 'Delete failed',
            error: error.message
        });
    }
});

// Rename file
router.put('/rename', auth, async (req, res) => {
    try {
        const { fileId, newName } = req.body;
        const userId = req.user.userId;

        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({
                message: 'File not found'
            });
        }

        // Check permissions
        if (!file.hasPermission(userId, 'write')) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        // Update file name
        file.name = newName;
        file.originalName = newName;
        await file.save();

        res.json({
            message: 'File renamed successfully',
            file: {
                id: file._id,
                name: file.name,
                path: file.path
            }
        });

    } catch (error) {
        console.error('Rename error:', error);
        res.status(500).json({
            message: 'Rename failed',
            error: error.message
        });
    }
});

// Move file
router.put('/move', auth, async (req, res) => {
    try {
        const { fileId, targetPath } = req.body;
        const userId = req.user.userId;

        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({
                message: 'File not found'
            });
        }

        // Check permissions
        if (!file.hasPermission(userId, 'write')) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        // Update file path
        file.path = targetPath === '/' ? file.name : `${targetPath}/${file.name}`;
        await file.save();

        res.json({
            message: 'File moved successfully',
            file: {
                id: file._id,
                name: file.name,
                path: file.path
            }
        });

    } catch (error) {
        console.error('Move error:', error);
        res.status(500).json({
            message: 'Move failed',
            error: error.message
        });
    }
});

// Create folder
router.post('/folder', auth, async (req, res) => {
    try {
        const { name, path: folderPath = '/' } = req.body;
        const userId = req.user.userId;

        // Check if folder already exists
        const existingFolder = await File.findOne({
            name,
            path: folderPath === '/' ? name : `${folderPath}/${name}`,
            ownerId: userId,
            isFolder: true,
            isDeleted: false
        });

        if (existingFolder) {
            return res.status(400).json({
                message: 'Folder already exists'
            });
        }

        // Create folder
        const folder = new File({
            name,
            originalName: name,
            path: folderPath === '/' ? name : `${folderPath}/${name}`,
            size: 0,
            mimeType: 'application/x-directory',
            extension: '',
            isFolder: true,
            ownerId: userId
        });

        await folder.save();

        res.json({
            message: 'Folder created successfully',
            folder: {
                id: folder._id,
                name: folder.name,
                isFolder: folder.isFolder,
                path: folder.path,
                createdAt: folder.createdAt
            }
        });

    } catch (error) {
        console.error('Create folder error:', error);
        res.status(500).json({
            message: 'Create folder failed',
            error: error.message
        });
    }
});

// Share file
router.post('/share', auth, async (req, res) => {
    try {
        const { fileId, email, permission = 'read' } = req.body;
        const userId = req.user.userId;

        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({
                message: 'File not found'
            });
        }

        // Check permissions
        if (!file.hasPermission(userId, 'admin')) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        // Create share link
        const shareToken = file.createShareLink();
        await file.save();

        const shareUrl = `${req.protocol}://${req.get('host')}/share/${shareToken}`;

        res.json({
            message: 'File shared successfully',
            shareUrl: shareUrl,
            shareToken: shareToken
        });

    } catch (error) {
        console.error('Share error:', error);
        res.status(500).json({
            message: 'Share failed',
            error: error.message
        });
    }
});

// Search files
router.get('/search', auth, async (req, res) => {
    try {
        const { q: query } = req.query;
        const userId = req.user.userId;

        if (!query) {
            return res.status(400).json({
                message: 'Search query is required'
            });
        }

        const files = await File.find({
            ownerId: userId,
            isDeleted: false,
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { originalName: { $regex: query, $options: 'i' } }
            ]
        })
        .sort({ lastAccessedAt: -1 })
        .limit(50);

        res.json({
            files: files.map(file => ({
                id: file._id,
                name: file.name,
                size: file.size,
                type: file.mimeType,
                isFolder: file.isFolder,
                path: file.path,
                createdAt: file.createdAt,
                modifiedAt: file.updatedAt,
                lastAccessedAt: file.lastAccessedAt
            }))
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            message: 'Search failed',
            error: error.message
        });
    }
});

module.exports = router; 