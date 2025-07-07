// Main Application Script
class DropboxClone {
    constructor() {
        this.isInitialized = false;
        this.managers = {};

        this.initializeApp();
    }

    // Initialize the entire application
    async initializeApp() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                await this.init();
            }
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showInitializationError(error);
        }
    }

    // Main initialization
    async init() {
        try {
            // Setup error handlers
            this.setupErrorHandlers();

            // Initialize managers
            this.initializeManagers();

            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Setup performance monitoring
            this.setupPerformanceMonitoring();

            // Setup connectivity monitoring
            this.setupConnectivityMonitoring();

            // Setup service worker (if available)
            this.setupServiceWorker();

            this.isInitialized = true;
            console.log('Dropbox Clone initialized successfully');

        } catch (error) {
            console.error('Initialization failed:', error);
            this.showInitializationError(error);
        }
    }

    // Initialize all managers
    initializeManagers() {
        // Managers are initialized in their respective files
        // We just store references here for coordination

        // Wait for managers to be available
        const checkManagers = () => {
            if (window.authManager && window.fileManager &&
                window.uploadManager && window.previewManager) {

                this.managers = {
                    auth: window.authManager,
                    file: window.fileManager,
                    upload: window.uploadManager,
                    preview: window.previewManager
                };

                // Setup inter-manager communication
                this.setupManagerCommunication();

                console.log('All managers initialized');
            } else {
                // Retry after a short delay
                setTimeout(checkManagers, 100);
            }
        };

        checkManagers();
    }

    // Setup communication between managers
    setupManagerCommunication() {
        // Custom events for manager communication
        const eventBus = document.createElement('div');
        window.eventBus = eventBus;

        // File upload completed event
        eventBus.addEventListener('file-uploaded', async(e) => {
            await this.managers.file.loadFiles();
            await this.managers.file.loadStorageInfo();
        });

        // File deleted event
        eventBus.addEventListener('file-deleted', async(e) => {
            await this.managers.file.loadStorageInfo();
        });

        // Storage quota warning
        eventBus.addEventListener('storage-warning', (e) => {
            Utils.showNotification(
                '저장 공간이 부족합니다. 불필요한 파일을 삭제해주세요.',
                'warning'
            );
        });

        // Authentication state changed
        eventBus.addEventListener('auth-changed', (e) => {
            if (e.detail.authenticated) {
                this.onUserLogin();
            } else {
                this.onUserLogout();
            }
        });

        // Auth initialization completed
        eventBus.addEventListener('auth-initialized', (e) => {
            console.log('Auth initialization completed');
            this.markAppAsReady();
        });
    }

    // Setup global error handlers
    setupErrorHandlers() {
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);

            // Don't show notification for auth errors (they're handled separately)
            if (!event.reason.message?.includes('auth')) {
                Utils.showNotification(
                    '예상치 못한 오류가 발생했습니다.',
                    'error'
                );
            }

            event.preventDefault();
        });

        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);

            Utils.showNotification(
                '페이지에서 오류가 발생했습니다.',
                'error'
            );
        });

        // Network error handler
        window.addEventListener('online', () => {
            Utils.showNotification('인터넷 연결이 복구되었습니다.');
        });

        window.addEventListener('offline', () => {
            Utils.showNotification(
                '인터넷 연결이 끊어졌습니다.',
                'warning'
            );
        });
    }

    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Ctrl/Cmd combinations
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'u':
                        e.preventDefault();
                        this.triggerUpload();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.focusSearch();
                        break;
                    case 'n':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.createNewFolder();
                        }
                        break;
                    case 'a':
                        e.preventDefault();
                        this.selectAllFiles();
                        break;
                    case 'd':
                        e.preventDefault();
                        this.downloadSelectedFiles();
                        break;
                }
            }

            // Function keys
            switch (e.key) {
                case 'Delete':
                    this.deleteSelectedFiles();
                    break;
                case 'F2':
                    e.preventDefault();
                    this.renameSelectedFile();
                    break;
                case 'F5':
                    e.preventDefault();
                    this.refreshFileList();
                    break;
            }
        });
    }

    // Setup performance monitoring
    setupPerformanceMonitoring() {
        // Monitor large file operations
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const start = performance.now();
            const response = await originalFetch.apply(this, args);
            const duration = performance.now() - start;

            // Log slow requests
            if (duration > 5000) {
                console.warn(`Slow request detected: ${args[0]} took ${duration}ms`);
            }

            return response;
        };

        // Monitor memory usage
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
                const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);

                if (usedMB / limitMB > 0.9) {
                    console.warn(`High memory usage: ${usedMB}MB / ${limitMB}MB`);
                }
            }, 30000);
        }
    }

    // Setup connectivity monitoring
    setupConnectivityMonitoring() {
        let isOnline = navigator.onLine;

        const checkConnectivity = async() => {
            try {
                // 🔥 FIXED: 올바른 백엔드 서버로 ping 요청
                const backendUrl = CONFIG.API_BASE_URL || 'https://philip-box.onrender.com/api';
                const pingUrl = backendUrl.replace('/api', '') + '/health';
                
                await fetch(pingUrl, {
                    method: 'HEAD',
                    mode: 'cors',
                    cache: 'no-cache',
                    timeout: 5000
                });

                if (!isOnline) {
                    isOnline = true;
                    this.onConnectivityRestored();
                }
            } catch (error) {
                console.log('🌐 Network check failed:', error.message);
                if (isOnline) {
                    isOnline = false;
                    this.onConnectivityLost();
                }
            }
        };

        // Check every 30 seconds
        setInterval(checkConnectivity, 30000);
        
        // Also listen to browser online/offline events
        window.addEventListener('online', () => {
            console.log('🌐 Browser detected online');
            isOnline = true;
            this.onConnectivityRestored();
        });
        
        window.addEventListener('offline', () => {
            console.log('🌐 Browser detected offline');
            isOnline = false;
            this.onConnectivityLost();
        });
    }

    // Setup service worker for offline support
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }

    // Keyboard shortcut handlers
    triggerUpload() {
        if (this.managers.upload) {
            this.managers.upload.triggerFileSelection();
        }
    }

    focusSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    createNewFolder() {
        if (this.managers.file) {
            this.managers.file.showCreateFolderDialog();
        }
    }

    selectAllFiles() {
        if (this.managers.file) {
            const files = this.managers.file.getCurrentFiles();
            files.forEach(file => {
                this.managers.file.toggleFileSelection(file);
            });
        }
    }

    downloadSelectedFiles() {
        if (this.managers.file) {
            this.managers.file.downloadSelectedFiles();
        }
    }

    deleteSelectedFiles() {
        if (this.managers.file) {
            this.managers.file.deleteSelectedFiles();
        }
    }

    renameSelectedFile() {
        if (this.managers.file) {
            this.managers.file.renameSelectedFile();
        }
    }

    refreshFileList() {
        if (this.managers.file) {
            this.managers.file.loadFiles();
        }
    }

    // Event handlers
    onUserLogin() {
        console.log('User logged in');

        // Load initial data
        if (this.managers.file) {
            this.managers.file.loadFiles();
            this.managers.file.loadStorageInfo();
        }

        // Setup periodic refresh
        this.setupPeriodicRefresh();

        // Mark app as ready
        this.markAppAsReady();
    }

    onUserLogout() {
        console.log('User logged out');

        // Clear periodic refresh
        this.clearPeriodicRefresh();

        // Clear cached data
        this.clearCachedData();

        // Remove ready state
        this.removeAppReadyState();
    }

    onConnectivityLost() {
        console.log('Connectivity lost');
        Utils.showNotification(
            '인터넷 연결이 불안정합니다. 일부 기능이 제한될 수 있습니다.',
            'warning'
        );
    }

    onConnectivityRestored() {
        console.log('Connectivity restored');
        Utils.showNotification('인터넷 연결이 복구되었습니다.');

        // Refresh data
        if (this.managers.file) {
            this.managers.file.loadFiles();
            this.managers.file.loadStorageInfo();
        }
    }

    // Setup periodic refresh
    setupPeriodicRefresh() {
        this.refreshInterval = setInterval(() => {
            if (this.managers.file && this.managers.auth.isAuthenticated()) {
                this.managers.file.loadStorageInfo();
            }
        }, 60000); // Every minute
    }

    // Clear periodic refresh
    clearPeriodicRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Clear cached data
    clearCachedData() {
        // Clear any cached file data
        if (this.managers.file) {
            this.managers.file.currentFiles = [];
            this.managers.file.selectedFiles = [];
        }
    }

    // Show initialization error
    showInitializationError(error) {
        const errorHtml = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                text-align: center;
                z-index: 10000;
            ">
                <i class="fas fa-exclamation-triangle" style="
                    font-size: 48px;
                    color: #dc3545;
                    margin-bottom: 20px;
                    display: block;
                "></i>
                <h2>앱 초기화 실패</h2>
                <p>애플리케이션을 시작할 수 없습니다.</p>
                <p style="color: #666; font-size: 14px;">${error.message}</p>
                <button onclick="window.location.reload()" style="
                    background: #0061ff;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    margin-top: 20px;
                ">
                    새로고침
                </button>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', errorHtml);
    }

    // Utility methods
    getAppInfo() {
        return {
            initialized: this.isInitialized,
            managers: Object.keys(this.managers),
            version: '1.0.0',
            features: [
                'File Upload & Download',
                'Drag & Drop',
                'File Preview',
                'Folder Management',
                'Search',
                'User Authentication',
                'Storage Management'
            ]
        };
    }

    // Debug methods
    debug() {
        console.log('Dropbox Clone Debug Info:', this.getAppInfo());
        console.log('Auth Manager:', this.managers.auth);
        console.log('File Manager:', this.managers.file);
        console.log('Upload Manager:', this.managers.upload);
        console.log('Preview Manager:', this.managers.preview);
    }

    // Performance profiling
    startProfiling() {
        if (window.performance && performance.mark) {
            performance.mark('app-profiling-start');
        }
    }

    endProfiling() {
        if (window.performance && performance.mark && performance.measure) {
            performance.mark('app-profiling-end');
            performance.measure('app-profiling', 'app-profiling-start', 'app-profiling-end');

            const measurements = performance.getEntriesByType('measure');
            const appProfiling = measurements.find(m => m.name === 'app-profiling');

            if (appProfiling) {
                console.log(`App profiling: ${appProfiling.duration}ms`);
            }
        }
    }

    // Mark app as ready
    markAppAsReady() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.add('ready');
        }

        // Trigger app ready event
        if (window.eventBus) {
            window.eventBus.dispatchEvent(new CustomEvent('app-ready'));
        }

        console.log('App marked as ready');
    }

    // Remove app ready state
    removeAppReadyState() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.remove('ready');
        }

        console.log('App ready state removed');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Create global app instance
    window.dropboxClone = new DropboxClone();

    // Expose debug functions globally (for development)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.debug = () => window.dropboxClone.debug();
        window.appInfo = () => window.dropboxClone.getAppInfo();
    }
});

// Handle app visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // App is hidden, pause non-essential operations
        console.log('App hidden');
    } else {
        // App is visible, resume operations
        console.log('App visible');

        // Refresh data if authenticated
        if (window.dropboxClone ?.managers ?.auth ?.isAuthenticated()) {
            window.dropboxClone.managers.file ?.loadStorageInfo();
        }
    }
});

// Global utility functions
window.utils = {
    // Format bytes
    formatBytes: Utils.formatFileSize,

    // Format date
    formatDate: Utils.formatDate,

    // Copy to clipboard
    copy: Utils.copyToClipboard,

    // Show notification
    notify: Utils.showNotification,

    // API request
    api: Utils.apiRequest
};

// Export main app class
window.DropboxClone = DropboxClone;

document.getElementById('shareFile').addEventListener('click', async() => {
    const file = fileManager.getSelectedFile(); // 선택된 파일 받아오기 함수 필요
    if (!file) {
        Utils.showNotification('공유할 파일을 선택해주세요.', 'error');
        return;
    }

    document.getElementById('shareFileName').textContent = file.name;
    document.getElementById('shareLink').value = '';
    document.getElementById('copyShareLink').disabled = true;
    document.getElementById('testShareLink').disabled = true;
    document.getElementById('revokeShareLink').disabled = true;
    document.getElementById('shareLinkNote').style.display = 'none';
    document.getElementById('shareModal').style.display = 'block';

    // 링크 생성
    document.getElementById('generateShareLink').onclick = async() => {
        const shareUrl = await shareManager.createShareLink(file.id);
        if (shareUrl) {
            document.getElementById('shareLink').value = shareUrl;
            document.getElementById('copyShareLink').disabled = false;
            document.getElementById('testShareLink').disabled = false;
            document.getElementById('revokeShareLink').disabled = false;
            document.getElementById('shareLinkNote').style.display = 'block';
        }
    };

    // 복사
    document.getElementById('copyShareLink').onclick = () => {
        navigator.clipboard.writeText(document.getElementById('shareLink').value);
        Utils.showNotification('공유 링크가 복사되었습니다.');
    };

    // 테스트
    document.getElementById('testShareLink').onclick = () => {
        window.open(document.getElementById('shareLink').value, '_blank');
    };

    // 취소
    document.getElementById('revokeShareLink').onclick = () => {
        document.getElementById('shareLink').value = '';
        document.getElementById('copyShareLink').disabled = true;
        document.getElementById('testShareLink').disabled = true;
        document.getElementById('revokeShareLink').disabled = true;
        document.getElementById('shareLinkNote').style.display = 'none';
        Utils.showNotification('공유 링크가 제거되었습니다.');
    };
});