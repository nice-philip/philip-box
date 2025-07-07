const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { initializeFirebase } = require('./firebase-config');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy for deployment platforms like Render.com
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Initialize Firebase
try {
    if (process.env.NODE_ENV === 'production' && process.env.FIREBASE_PROJECT_ID) {
        initializeFirebase();
        console.log('🔥 Firebase initialized successfully');
    } else {
        console.log('🔥 Firebase disabled for local development');
    }
} catch (error) {
    console.error('Firebase initialization failed:', error);
}

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/philip-box';
console.log('MongoDB URI:', MONGODB_URI);

mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        console.log('⚠️  MongoDB connection failed - Some features may not work');
    });

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: [
        'https://jovial-toffee-39ae6b.netlify.app',
        'https://philip-box.onrender.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:8080'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);

// File upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        files: 10 // max 10 files at once
    },
    fileFilter: (req, file, cb) => {
        // Allow all file types for now
        cb(null, true);
    }
});

// Static files
app.use(express.static(path.join(__dirname, 'client')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Import models
const User = require('./models/User');
const File = require('./models/File');

// Import routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const storageRoutes = require('./routes/storage');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/storage', storageRoutes);

// 🔥 NEW: Direct file access route (before catch-all route)
app.get('/file/:id', async (req, res) => {
    try {
        const fileId = req.params.id;
        
        console.log('Direct file access request for ID:', fileId);
        
        // Find file by ID
        const file = await File.findById(fileId);
        if (!file) {
            console.log('File not found:', fileId);
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>파일을 찾을 수 없습니다 - Philip Box</title>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .error { color: #dc3545; }
                        .container { max-width: 500px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1 class="error">404 - 파일을 찾을 수 없습니다</h1>
                        <p>요청하신 파일이 존재하지 않거나 삭제되었습니다.</p>
                        <a href="/">홈으로 돌아가기</a>
                    </div>
                </body>
                </html>
            `);
        }

        if (file.isDeleted) {
            console.log('File is deleted:', fileId);
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>파일이 삭제되었습니다 - Philip Box</title>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .error { color: #dc3545; }
                        .container { max-width: 500px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1 class="error">파일이 삭제되었습니다</h1>
                        <p>요청하신 파일이 삭제되어 더 이상 사용할 수 없습니다.</p>
                        <a href="/">홈으로 돌아가기</a>
                    </div>
                </body>
                </html>
            `);
        }

        // Update last accessed time
        file.lastAccessedAt = new Date();
        await file.save();

        console.log('File access successful:', {
            id: file._id,
            name: file.name,
            size: file.size
        });

        // For files, redirect to Firebase download URL or serve file content
        if (!file.isFolder && file.firebaseDownloadUrl) {
            console.log('Redirecting to Firebase download URL');
            return res.redirect(file.firebaseDownloadUrl);
        }

        // For folders or files without download URL, show file info page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${file.name} - Philip Box</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        max-width: 800px; 
                        margin: 0 auto; 
                        padding: 20px;
                        background-color: #f8f9fa;
                    }
                    .file-info { 
                        background: white; 
                        padding: 30px; 
                        border-radius: 8px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .file-icon { 
                        font-size: 48px; 
                        text-align: center; 
                        margin-bottom: 20px;
                        color: #6c757d;
                    }
                    .file-name { 
                        font-size: 24px; 
                        font-weight: bold; 
                        margin-bottom: 10px;
                        text-align: center;
                    }
                    .file-details { 
                        margin: 20px 0;
                    }
                    .detail-row { 
                        display: flex; 
                        justify-content: space-between; 
                        padding: 8px 0;
                        border-bottom: 1px solid #eee;
                    }
                    .actions {
                        text-align: center;
                        margin-top: 30px;
                    }
                    .btn {
                        display: inline-block;
                        padding: 10px 20px;
                        margin: 0 10px;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: bold;
                    }
                    .btn-primary {
                        background-color: #007bff;
                        color: white;
                    }
                    .btn-secondary {
                        background-color: #6c757d;
                        color: white;
                    }
                </style>
            </head>
            <body>
                <div class="file-info">
                    <div class="file-icon">📁</div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-details">
                        <div class="detail-row">
                            <span>크기:</span>
                            <span>${formatFileSize(file.size)}</span>
                        </div>
                        <div class="detail-row">
                            <span>타입:</span>
                            <span>${file.mimeType}</span>
                        </div>
                        <div class="detail-row">
                            <span>생성일:</span>
                            <span>${new Date(file.createdAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                        <div class="detail-row">
                            <span>수정일:</span>
                            <span>${new Date(file.updatedAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                        <div class="detail-row">
                            <span>마지막 접근:</span>
                            <span>${new Date(file.lastAccessedAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                    </div>
                    <div class="actions">
                        ${file.firebaseDownloadUrl ? `<a href="${file.firebaseDownloadUrl}" class="btn btn-primary">다운로드</a>` : ''}
                        <a href="/" class="btn btn-secondary">홈으로 돌아가기</a>
                    </div>
                </div>
                
                <script>
                    function formatFileSize(bytes) {
                        if (bytes === 0) return '0 Bytes';
                        const k = 1024;
                        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                        const i = Math.floor(Math.log(bytes) / Math.log(k));
                        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                    }
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('File access error:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>오류 발생 - Philip Box</title>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .error { color: #dc3545; }
                    .container { max-width: 500px; margin: 0 auto; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="error">오류가 발생했습니다</h1>
                    <p>파일 접근 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
                    <a href="/">홈으로 돌아가기</a>
                </div>
            </body>
            </html>
        `);
    }
});

// 🔥 NEW: File info API endpoint (returns JSON)
app.get('/api/file/:id/info', async (req, res) => {
    try {
        const fileId = req.params.id;
        
        console.log('File info API request for ID:', fileId);
        
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
        console.error('File info API error:', error);
        res.status(500).json({
            message: 'File info failed',
            error: error.message
        });
    }
});

// Helper function for file size formatting
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Serve React app for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            message: 'File too large',
            error: 'File size exceeds the maximum limit of 100MB'
        });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
            message: 'Too many files',
            error: 'Maximum 10 files can be uploaded at once'
        });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            message: 'Validation error',
            error: err.message
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            message: 'Unauthorized',
            error: 'Invalid or expired token'
        });
    }

    // Default error
    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        message: 'API endpoint not found',
        error: `Cannot ${req.method} ${req.originalUrl}`
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');

    // Close server
    server.close(async () => {
        console.log('HTTP server closed.');

        // Close database connection
        try {
            await mongoose.connection.close();
            console.log('MongoDB connection closed.');
        } catch (error) {
            console.error('Error closing MongoDB connection:', error);
        }
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');

    server.close(async () => {
        console.log('HTTP server closed.');

        try {
            await mongoose.connection.close();
            console.log('MongoDB connection closed.');
        } catch (error) {
            console.error('Error closing MongoDB connection:', error);
        }
        process.exit(0);
    });
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, 'client')}`);
    console.log(`🔥 Firebase Storage: ${process.env.FIREBASE_STORAGE_BUCKET}`);
    console.log(`🗄️  MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
});

module.exports = app;

app.post('/upload', upload.single('file'), (req, res) => {
    const uploadPath = req.body.path || '/';
    console.log('업로드된 경로:', uploadPath);

    // 해당 폴더 경로에 파일 저장 처리 로직...
});

app.post('/api/share', async(req, res) => {
    const { fileId } = req.body;

    // 공유 링크 생성 예시
    const shareToken = generateUniqueToken(); // 랜덤 토큰 생성
    const shareUrl = `https://yourdomain.com/share/${shareToken}`;

    // DB에 저장 (예시)
    await db.collection('sharedLinks').insertOne({
        fileId,
        token: shareToken,
        createdAt: new Date()
    });

    res.json({ shareUrl });
});