# Dropbox Clone

A full-featured Dropbox clone built with vanilla HTML, CSS, JavaScript frontend and Node.js/Express backend with MongoDB and AWS S3 storage.

## Features

### Core Features
- 📁 **File Management**: Upload, download, delete, rename, and organize files
- 📂 **Folder Management**: Create, rename, and navigate folders
- 🔍 **Search**: Find files and folders quickly
- 👀 **File Preview**: Preview images, videos, audio, text files, and PDFs
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🎨 **Modern UI**: Clean, intuitive interface inspired by Dropbox

### Advanced Features
- 🔐 **User Authentication**: Secure login and registration system
- 💾 **Storage Management**: Track storage usage with quota limits
- 🚀 **Drag & Drop Upload**: Easy file uploads with progress tracking
- 📊 **Chunked Upload**: Large file support with resumable uploads
- 🔗 **File Sharing**: Generate shareable links for files
- 🗂️ **File Organization**: Grid and list view modes
- ⏱️ **Recent Files**: Quick access to recently viewed files
- 🗑️ **Trash**: Soft delete with restore functionality

### Technical Features
- ☁️ **AWS S3 Integration**: Scalable cloud storage
- 🛡️ **Security**: JWT authentication, input validation, rate limiting
- 📈 **Performance**: Caching, compression, optimized queries
- 🔄 **Real-time Updates**: Live storage usage updates
- 📱 **PWA Ready**: Service worker support for offline functionality

## Tech Stack

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with flexbox/grid
- **Vanilla JavaScript**: No frameworks, pure ES6+
- **Font Awesome**: Icon library

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **MongoDB**: Database with Mongoose ODM
- **AWS S3**: File storage
- **JWT**: Authentication
- **Multer**: File upload handling

### Development Tools
- **Git**: Version control
- **npm**: Package management
- **dotenv**: Environment variables
- **bcryptjs**: Password hashing
- **helmet**: Security middleware

## Prerequisites

Before you begin, ensure you have:

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- AWS S3 bucket
- Git

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nice-philip/philip-box.git
   cd philip-box
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=8080
   HOST=localhost

   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/dropbox-clone

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=7d

   # AWS S3 Configuration
   AWS_ACCESS_KEY_ID=your-aws-access-key-id
   AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
   AWS_REGION=us-east-1
   S3_BUCKET_NAME=your-dropbox-clone-bucket

   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Set up AWS S3**
   - Create an S3 bucket
   - Set up IAM user with S3 permissions
   - Add credentials to `.env` file

5. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Update `MONGODB_URI` in `.env` file

6. **Start the application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

7. **Access the application**
   - Open http://localhost:8080 in your browser
   - Register a new account or login

## Project Structure

```
philip-box/
├── client/                 # Frontend files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # Main stylesheet
│   ├── config.js          # Configuration
│   ├── utils.js           # Utility functions
│   ├── auth.js            # Authentication manager
│   ├── fileManager.js     # File management
│   ├── upload.js          # Upload manager
│   ├── preview.js         # File preview
│   ├── script.js          # Main application
│   └── package.json       # Frontend dependencies
├── models/                # Database models
│   ├── User.js            # User model
│   └── File.js            # File model
├── routes/                # API routes
│   ├── auth.js            # Authentication routes
│   ├── files.js           # File management routes
│   └── storage.js         # Storage management routes
├── middleware/            # Express middleware
│   └── auth.js            # Authentication middleware
├── server.js              # Main server file
├── package.json           # Backend dependencies
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/profile` - Get user profile

### Files
- `GET /api/files` - List files
- `POST /api/files/upload` - Upload file
- `GET /api/files/download/:id` - Download file
- `DELETE /api/files/delete` - Delete file
- `PUT /api/files/rename` - Rename file
- `PUT /api/files/move` - Move file
- `POST /api/files/folder` - Create folder
- `POST /api/files/share` - Share file
- `GET /api/files/search` - Search files

### Storage
- `GET /api/storage/usage` - Get storage usage
- `PUT /api/storage/quota` - Update storage quota (admin)
- `POST /api/storage/cleanup` - Cleanup deleted files (admin)
- `GET /api/storage/stats` - Get global statistics (admin)

## Usage

### Basic Operations

1. **Upload Files**
   - Click the "업로드" button or drag & drop files
   - Support for multiple files and large files (up to 100MB)
   - Real-time progress tracking

2. **Create Folders**
   - Click "새 폴더" button
   - Enter folder name
   - Navigate using breadcrumb or double-click

3. **File Preview**
   - Double-click any file to preview
   - Supports images, videos, audio, text, and PDF files
   - Use arrow keys to navigate between files

4. **File Management**
   - Right-click for context menu
   - Rename, move, share, or delete files
   - Use keyboard shortcuts for quick actions

### Keyboard Shortcuts

- `Ctrl+U` - Upload files
- `Ctrl+F` - Focus search
- `Ctrl+Shift+N` - Create new folder
- `Ctrl+A` - Select all files
- `Delete` - Delete selected files
- `F2` - Rename selected file
- `F5` - Refresh file list
- `Esc` - Close modals/preview

## Deployment

### Render.com (Recommended)

1. **Prepare for deployment**
   ```bash
   # Build script (if needed)
   npm run build
   ```

2. **Deploy to Render**
   - Connect your GitHub repository
   - Set environment variables in Render dashboard
   - Deploy automatically on git push

### Manual Deployment

1. **Set environment variables**
   ```bash
   export NODE_ENV=production
   export MONGODB_URI=your-production-mongodb-uri
   export AWS_ACCESS_KEY_ID=your-aws-key
   # ... other variables
   ```

2. **Start the application**
   ```bash
   npm start
   ```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security Considerations

- Change default JWT secret in production
- Use strong passwords for AWS and MongoDB
- Enable HTTPS in production
- Regularly update dependencies
- Monitor for security vulnerabilities

## Performance Optimization

- Enable gzip compression
- Use CDN for static assets
- Implement caching strategies
- Optimize database queries
- Use connection pooling

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check MongoDB service is running
   - Verify connection string in `.env`
   - Check network connectivity

2. **AWS S3 Upload Error**
   - Verify AWS credentials
   - Check S3 bucket permissions
   - Ensure bucket exists and is accessible

3. **File Upload Fails**
   - Check file size limits
   - Verify storage quota
   - Check network connection

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by Dropbox's user interface
- Built with modern web technologies
- Thanks to the open-source community

## Support

If you encounter any issues or have questions:

1. Check the troubleshooting section
2. Search existing issues on GitHub
3. Create a new issue with detailed information
4. Contact the maintainers

---

Made with ❤️ by Philip 