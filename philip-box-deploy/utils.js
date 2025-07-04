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
            return fileDate.toLocaleDateString('ko-KR');
        }
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

    // API request helper
    static async apiRequest(url, options = {}) {
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

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
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API 요청에 실패했습니다.');
            }

            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // Show notification
    static showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        notification.className = `notification ${type}`;
        notificationText.textContent = message;
        
        notification.classList.add('active');
        
        setTimeout(() => {
            notification.classList.remove('active');
        }, 3000);
    }

    // Show loading
    static showLoading(show = true) {
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (show) {
            loadingSpinner.classList.add('active');
        } else {
            loadingSpinner.classList.remove('active');
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

    // Download file
    static downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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

    // Format storage usage text
    static formatStorageUsage(used, total) {
        const usedFormatted = this.formatFileSize(used);
        const totalFormatted = this.formatFileSize(total);
        return `${usedFormatted} / ${totalFormatted} 사용`;
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
        const prefsStr = localStorage.getItem(CONFIG.STORAGE_KEYS.PREFERENCES);
        return prefsStr ? JSON.parse(prefsStr) : {
            viewMode: CONFIG.VIEW_MODES.GRID,
            sortBy: 'name',
            sortOrder: 'asc'
        };
    }

    // Add to recent files
    static addToRecentFiles(fileInfo) {
        const recentFiles = this.getRecentFiles();
        const existingIndex = recentFiles.findIndex(f => f.id === fileInfo.id);
        
        if (existingIndex !== -1) {
            recentFiles.splice(existingIndex, 1);
        }
        
        recentFiles.unshift({
            ...fileInfo,
            accessedAt: new Date().toISOString()
        });
        
        // Keep only last 50 files
        if (recentFiles.length > 50) {
            recentFiles.splice(50);
        }
        
        localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_FILES, JSON.stringify(recentFiles));
    }

    // Get recent files
    static getRecentFiles() {
        const recentStr = localStorage.getItem(CONFIG.STORAGE_KEYS.RECENT_FILES);
        return recentStr ? JSON.parse(recentStr) : [];
    }

    // Clear recent files
    static clearRecentFiles() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.RECENT_FILES);
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
        
        if (CONFIG.APP_CONFIG.SUPPORTED_PREVIEW_TYPES.image.includes(ext)) {
            return 'image';
        } else if (CONFIG.APP_CONFIG.SUPPORTED_PREVIEW_TYPES.video.includes(ext)) {
            return 'video';
        } else if (CONFIG.APP_CONFIG.SUPPORTED_PREVIEW_TYPES.audio.includes(ext)) {
            return 'audio';
        } else if (CONFIG.APP_CONFIG.SUPPORTED_PREVIEW_TYPES.text.includes(ext)) {
            return 'text';
        } else if (CONFIG.APP_CONFIG.SUPPORTED_PREVIEW_TYPES.pdf.includes(ext)) {
            return 'pdf';
        }
        
        return null;
    }

    // Sort files
    static sortFiles(files, sortBy, sortOrder) {
        return [...files].sort((a, b) => {
            let aVal, bVal;
            
            switch (sortBy) {
                case 'name':
                    aVal = a.name.toLowerCase();
                    bVal = b.name.toLowerCase();
                    break;
                case 'size':
                    aVal = a.size || 0;
                    bVal = b.size || 0;
                    break;
                case 'date':
                    aVal = new Date(a.modifiedAt || a.createdAt);
                    bVal = new Date(b.modifiedAt || b.createdAt);
                    break;
                case 'type':
                    aVal = a.type || '';
                    bVal = b.type || '';
                    break;
                default:
                    return 0;
            }
            
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Filter files
    static filterFiles(files, searchTerm) {
        if (!searchTerm) return files;
        
        const term = searchTerm.toLowerCase();
        return files.filter(file => 
            file.name.toLowerCase().includes(term) ||
            (file.type && file.type.toLowerCase().includes(term))
        );
    }
}

// Export Utils
window.Utils = Utils; 