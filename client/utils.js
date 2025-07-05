// Utility Functions
class Utils {
    // Format file size
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Format date
    static formatDate(date) {
        if (!date) return '';
        const now = new Date();
        const fileDate = new Date(date);
        const diffTime = Math.abs(now - fileDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return '어제';
        } else if (diffDays < 7) {
            return `${diffDays}일 전`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks}주 전`;
        } else {
            return fileDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    // Format time (for ETA, duration, etc.)
    static formatTime(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)}초`;
        } else if (seconds < 3600) {
            return `${Math.round(seconds / 60)}분`;
        } else {
            return `${Math.round(seconds / 3600)}시간`;
        }
    }

    // Format detailed date
    static formatDetailedDate(date) {
        if (!date) return 'Unknown';
        return new Date(date).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Get file extension
    static getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    // Get file type icon
    static getFileTypeIcon(filename, isFolder = false) {
        if (isFolder) {
            return CONFIG.FILE_TYPE_ICONS.folder;
        }
        const ext = this.getFileExtension(filename);
        return CONFIG.FILE_TYPE_ICONS[ext] || CONFIG.FILE_TYPE_ICONS.default;
    }

    // Check if file type is supported for preview
    static isPreviewSupported(filename) {
        const ext = this.getFileExtension(filename);
        const previewTypes = CONFIG.APP_CONFIG.SUPPORTED_PREVIEW_TYPES;
        
        for (const type in previewTypes) {
            if (previewTypes[type].includes(ext)) {
                return type;
            }
        }
        return false;
    }

    // Check if file type supports thumbnail
    static isThumbnailSupported(filename) {
        if (!CONFIG.APP_CONFIG.THUMBNAIL_CONFIG.enabled) return false;
        
        const ext = this.getFileExtension(filename);
        return CONFIG.APP_CONFIG.THUMBNAIL_CONFIG.supportedTypes.includes(ext);
    }

    // Validate file
    static validateFile(file) {
        const errors = [];

        // Check file size
        if (file.size > CONFIG.APP_CONFIG.MAX_FILE_SIZE) {
            errors.push(CONFIG.ERROR_MESSAGES.FILE_TOO_LARGE);
        }

        // Check file type
        if (!CONFIG.APP_CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
            errors.push(CONFIG.ERROR_MESSAGES.INVALID_FILE_TYPE);
        }

        return errors;
    }

    // Generate unique ID
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Sanitize filename
    static sanitizeFilename(filename) {
        return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    }

    // Get breadcrumb path
    static getBreadcrumbPath(path) {
        if (!path || path === '/') return [{ name: '내 파일', path: '/' }];
        
        const parts = path.split('/').filter(p => p);
        const breadcrumb = [{ name: '내 파일', path: '/' }];
        
        let currentPath = '';
        parts.forEach(part => {
            currentPath += '/' + part;
            breadcrumb.push({ name: part, path: currentPath });
        });
        
        return breadcrumb;
    }

    // Debounce function
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Throttle function
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Enhanced API request helper
    static async apiRequest(url, method = 'GET', data = null, options = {}) {
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        
        const defaultOptions = {
            method: method,
            headers: {
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        // Handle different data types
        if (data) {
            if (data instanceof FormData) {
                // Don't set Content-Type for FormData, let browser set it with boundary
                defaultOptions.body = data;
            } else if (typeof data === 'object') {
                defaultOptions.headers['Content-Type'] = 'application/json';
                defaultOptions.body = JSON.stringify(data);
            } else {
                defaultOptions.body = data;
            }
        }

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, mergedOptions);
            
            // Handle different response types
            let responseData;
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            if (!response.ok) {
                const errorMessage = typeof responseData === 'object' && responseData.message 
                    ? responseData.message 
                    : 'API 요청에 실패했습니다.';
                throw new Error(errorMessage);
            }

            return responseData;
        } catch (error) {
            console.error('API Request Error:', error);
            
            // Handle network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error(CONFIG.ERROR_MESSAGES.NETWORK_ERROR);
            }
            
            throw error;
        }
    }

    // Show notification
    static showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        if (!notification || !notificationText) return;
        
        notification.className = `notification ${type}`;
        notificationText.textContent = message;
        
        notification.classList.add('active');
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('active');
        }, 3000);
    }

    // Show loading
    static showLoading(show = true) {
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            if (show) {
                loadingSpinner.classList.add('active');
            } else {
                loadingSpinner.classList.remove('active');
            }
        }
    }

    // Copy to clipboard
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('클립보드에 복사되었습니다.');
        } catch (error) {
            console.error('클립보드 복사 실패:', error);
            this.showNotification('클립보드 복사에 실패했습니다.', 'error');
        }
    }

    // Download file using blob
    static downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Convert file to base64
    static fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Get storage usage percentage
    static getStorageUsagePercentage(used, total) {
        return Math.round((used / total) * 100);
    }

    // Format storage usage
    static formatStorageUsage(used, total) {
        const usedFormatted = this.formatFileSize(used);
        const totalFormatted = this.formatFileSize(total);
        const percentage = this.getStorageUsagePercentage(used, total);
        return `${usedFormatted} / ${totalFormatted} (${percentage}%)`;
    }

    // Check if user is authenticated
    static isAuthenticated() {
        return !!localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    }

    // Get current user
    static getCurrentUser() {
        const userStr = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
        return userStr ? JSON.parse(userStr) : null;
    }

    // Save user preferences
    static savePreferences(preferences) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    }

    // Get user preferences
    static getPreferences() {
        const preferencesStr = localStorage.getItem(CONFIG.STORAGE_KEYS.PREFERENCES);
        return preferencesStr ? JSON.parse(preferencesStr) : {
            viewMode: CONFIG.VIEW_MODES.GRID,
            sortBy: 'name',
            sortOrder: 'asc'
        };
    }

    // Add to recent files
    static addToRecentFiles(fileInfo) {
        let recentFiles = this.getRecentFiles();
        
        // Remove existing entry
        recentFiles = recentFiles.filter(f => f.id !== fileInfo.id);
        
        // Add to beginning
        recentFiles.unshift({
            ...fileInfo,
            accessedAt: new Date().toISOString()
        });
        
        // Keep only last 50 files
        recentFiles = recentFiles.slice(0, 50);
        
        localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_FILES, JSON.stringify(recentFiles));
    }

    // Get recent files
    static getRecentFiles() {
        const recentFilesStr = localStorage.getItem(CONFIG.STORAGE_KEYS.RECENT_FILES);
        return recentFilesStr ? JSON.parse(recentFilesStr) : [];
    }

    // Clear recent files
    static clearRecentFiles() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.RECENT_FILES);
    }

    // Save search history
    static saveSearchHistory(query) {
        if (!query.trim()) return;
        
        let searchHistory = this.getSearchHistory();
        
        // Remove existing entry
        searchHistory = searchHistory.filter(q => q !== query);
        
        // Add to beginning
        searchHistory.unshift(query);
        
        // Keep only last 20 searches
        searchHistory = searchHistory.slice(0, 20);
        
        localStorage.setItem(CONFIG.STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(searchHistory));
    }

    // Get search history
    static getSearchHistory() {
        const searchHistoryStr = localStorage.getItem(CONFIG.STORAGE_KEYS.SEARCH_HISTORY);
        return searchHistoryStr ? JSON.parse(searchHistoryStr) : [];
    }

    // Clear search history
    static clearSearchHistory() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.SEARCH_HISTORY);
    }

    // Escape HTML
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Get file type for preview
    static getFileTypeForPreview(filename) {
        const ext = this.getFileExtension(filename);
        const previewTypes = CONFIG.APP_CONFIG.SUPPORTED_PREVIEW_TYPES;
        
        for (const [type, extensions] of Object.entries(previewTypes)) {
            if (extensions.includes(ext)) {
                return type;
            }
        }
        
        return null;
    }

    // Check if file is image
    static isImage(filename) {
        const ext = this.getFileExtension(filename);
        return CONFIG.APP_CONFIG.SUPPORTED_PREVIEW_TYPES.image.includes(ext);
    }

    // Check if file is video
    static isVideo(filename) {
        const ext = this.getFileExtension(filename);
        return CONFIG.APP_CONFIG.SUPPORTED_PREVIEW_TYPES.video.includes(ext);
    }

    // Check if file is audio
    static isAudio(filename) {
        const ext = this.getFileExtension(filename);
        return CONFIG.APP_CONFIG.SUPPORTED_PREVIEW_TYPES.audio.includes(ext);
    }

    // Sort files
    static sortFiles(files, sortBy, sortOrder) {
        return files.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];
            
            // Handle different data types
            if (sortBy === 'size') {
                aValue = parseInt(aValue) || 0;
                bValue = parseInt(bValue) || 0;
            } else if (sortBy === 'modified' || sortBy === 'created') {
                aValue = new Date(aValue).getTime();
                bValue = new Date(bValue).getTime();
            } else {
                aValue = (aValue || '').toString().toLowerCase();
                bValue = (bValue || '').toString().toLowerCase();
            }
            
            if (sortOrder === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });
    }

    // Filter files
    static filterFiles(files, searchTerm) {
        if (!searchTerm) return files;
        
        const term = searchTerm.toLowerCase();
        return files.filter(file => 
            file.name.toLowerCase().includes(term) ||
            (file.description && file.description.toLowerCase().includes(term))
        );
    }

    // Generate thumbnail URL
    static getThumbnailUrl(fileId) {
        return `${CONFIG.API_ENDPOINTS.files.thumbnail}/${fileId}`;
    }

    // Generate share URL
    static generateShareUrl(shareId) {
        return `${window.location.origin}/share/${shareId}`;
    }

    // Validate email
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate password
    static isValidPassword(password) {
        // At least 8 characters, contains letter and number
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
        return passwordRegex.test(password);
    }

    // Generate random string
    static generateRandomString(length = 10) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Calculate file hash (simple hash for client-side)
    static async calculateFileHash(file) {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Format bytes per second
    static formatSpeed(bytesPerSecond) {
        return this.formatFileSize(bytesPerSecond) + '/s';
    }

    // Get MIME type from extension
    static getMimeType(filename) {
        const ext = this.getFileExtension(filename);
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'txt': 'text/plain',
            'csv': 'text/csv',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'text/javascript',
            'json': 'application/json',
            'xml': 'application/xml',
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed',
            '7z': 'application/x-7z-compressed',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'avi': 'video/x-msvideo'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }

    // Check if device is mobile
    static isMobile() {
        return window.innerWidth <= 768;
    }

    // Handle offline/online events
    static setupNetworkStatus() {
        window.addEventListener('online', () => {
            this.showNotification('인터넷 연결이 복구되었습니다.', 'success');
        });

        window.addEventListener('offline', () => {
            this.showNotification('인터넷 연결이 끊어졌습니다.', 'warning');
        });
    }

    // Check network status
    static isOnline() {
        return navigator.onLine;
    }

    // Format relative time
    static formatRelativeTime(date) {
        const now = new Date();
        const then = new Date(date);
        const diffMs = now - then;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
        return `${Math.floor(diffDays / 365)}년 전`;
    }

    // Retry function with exponential backoff
    static async retry(fn, retries = 3, delay = 1000) {
        try {
            return await fn();
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.retry(fn, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    // Deep clone object
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // Merge objects
    static mergeObjects(target, ...sources) {
        return Object.assign({}, target, ...sources);
    }

    // Check if object is empty
    static isEmpty(obj) {
        return obj == null || Object.keys(obj).length === 0;
    }
}

// Initialize network status monitoring
Utils.setupNetworkStatus();

// Export Utils class
window.Utils = Utils; 