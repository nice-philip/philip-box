const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const File = require('../models/File');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { getStorageBucket } = require('../firebase-config');

const router = express.Router();

// Add debug logging for Firebase configuration
console.log('Firebase Configuration:', {
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? process.env.FIREBASE_CLIENT_EMAIL.substring(0, 20) + '...' : 'undefined'
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
                permissions: file.permissions,
                fileUrl: `${req.protocol}://${req.get('host')}/file/${file._id}`,
                downloadUrl: file.firebaseDownloadUrl
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
        
        // 🔥 FIXED: 폴더 경로를 Firebase Storage 경로에 포함
        const normalizedPath = filePath === '/' ? '' : filePath.replace(/^\/+|\/+$/g, '');
        const firebaseStoragePath = normalizedPath ? 
            `uploads/${userId}/${normalizedPath}/${fileName}` : 
            `uploads/${userId}/${fileName}`;

        console.log('Uploading to Firebase Storage:', { 
            bucket: process.env.FIREBASE_STORAGE_BUCKET, 
            path: firebaseStoragePath,
            size: req.file.size,
            folderPath: normalizedPath || 'root'
        });

        // Upload to Firebase Storage
        const bucket = getStorageBucket();
        const file = bucket.file(firebaseStoragePath);
        
        const stream = file.createWriteStream({
            metadata: {
                contentType: req.file.mimetype,
                metadata: {
                    originalName: req.file.originalname,
                    uploadedBy: userId.toString(),
                    folderPath: normalizedPath || 'root'
                }
            }
        });

        // Upload file using stream
        await new Promise((resolve, reject) => {
            stream.on('error', reject);
            stream.on('finish', resolve);
            stream.end(req.file.buffer);
        });

        // Get download URL
        const [downloadUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year from now
        });

        console.log('Firebase Storage upload successful:', downloadUrl);

        console.log('Creating file record in database');
        // Create file record
        const fileRecord = new File({
            name: req.file.originalname,
            originalName: req.file.originalname,
            // 🔥 FIXED: 파일이 속한 폴더의 경로 저장 (파일 전체 경로가 아닌 폴더 경로)
            path: filePath,
            size: req.file.size,
            mimeType: req.file.mimetype,
            extension: fileExtension.slice(1),
            ownerId: userId,
            firebaseStoragePath: firebaseStoragePath,
            firebaseDownloadUrl: downloadUrl
        });

        await fileRecord.save();
        console.log('File record saved:', fileRecord._id);

        // 🔥 Generate unique file URL
        const fileUrl = `${req.protocol}://${req.get('host')}/file/${fileRecord._id}`;
        console.log('Generated unique file URL:', fileUrl);

        console.log('Updating user storage usage');
        // Update user storage
        await user.updateStorageUsage(req.file.size);
        console.log('User storage updated successfully');

        res.json({
            message: 'File uploaded successfully',
            file: {
                id: fileRecord._id,
                name: fileRecord.name,
                size: fileRecord.size,
                type: fileRecord.mimeType,
                path: fileRecord.path,
                createdAt: fileRecord.createdAt,
                fileUrl: fileUrl,
                downloadUrl: downloadUrl
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

        // Generate signed URL for Firebase Storage download
        const bucket = getStorageBucket();
        const firebaseFile = bucket.file(file.firebaseStoragePath);
        
        const [downloadUrl] = await firebaseFile.getSignedUrl({
            action: 'read',
            expires: Date.now() + 3600 * 1000, // 1 hour from now
            responseDisposition: `attachment; filename="${file.originalName}"`
        });

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

// 🔥 NEW: File access route - Direct file access by ID
router.get('/file/:id', async (req, res) => {
    try {
        const fileId = req.params.id;
        
        console.log('File access request for ID:', fileId);
        
        // Find file by ID
        const file = await File.findById(fileId);
        if (!file) {
            console.log('File not found:', fileId);
            return res.status(404).json({
                message: 'File not found'
            });
        }

        if (file.isDeleted) {
            console.log('File is deleted:', fileId);
            return res.status(404).json({
                message: 'File not found'
            });
        }

        // Update last accessed time
        file.lastAccessedAt = new Date();
        await file.save();

        console.log('File access successful:', {
            id: file._id,
            name: file.name,
            size: file.size
        });

        // For files, redirect to Firebase download URL
        if (!file.isFolder && file.firebaseDownloadUrl) {
            console.log('Redirecting to Firebase download URL');
            return res.redirect(file.firebaseDownloadUrl);
        }

        // For folders or files without download URL, return file info
        res.json({
            file: {
                id: file._id,
                name: file.name,
                size: file.size,
                type: file.mimeType,
                isFolder: file.isFolder,
                path: file.path,
                createdAt: file.createdAt,
                modifiedAt: file.updatedAt,
                lastAccessedAt: file.lastAccessedAt,
                downloadUrl: file.firebaseDownloadUrl
            }
        });

    } catch (error) {
        console.error('File access error:', error);
        res.status(500).json({
            message: 'File access failed',
            error: error.message
        });
    }
});

// 🔥 NEW: Get file info by ID (without triggering download)
router.get('/info/:id', async (req, res) => {
    try {
        const fileId = req.params.id;
        
        console.log('File info request for ID:', fileId);
        
        // Find file by ID
        const file = await File.findById(fileId);
        if (!file) {
            console.log('File not found:', fileId);
            return res.status(404).json({
                message: 'File not found'
            });
        }

        if (file.isDeleted) {
            console.log('File is deleted:', fileId);
            return res.status(404).json({
                message: 'File not found'
            });
        }

        // Return file information
        res.json({
            file: {
                id: file._id,
                name: file.name,
                size: file.size,
                type: file.mimeType,
                isFolder: file.isFolder,
                path: file.path,
                createdAt: file.createdAt,
                modifiedAt: file.updatedAt,
                lastAccessedAt: file.lastAccessedAt,
                fileUrl: `${req.protocol}://${req.get('host')}/file/${file._id}`,
                downloadUrl: file.firebaseDownloadUrl
            }
        });

    } catch (error) {
        console.error('File info error:', error);
        res.status(500).json({
            message: 'File info failed',
            error: error.message
        });
    }
});

module.exports = router; 