// File Manager
class FileManager {
    constructor() {
        this.currentPath = '/';
        this.currentFiles = [];
        this.selectedFiles = [];
        this.currentSection = CONFIG.FILE_SECTIONS.FILES;
        this.viewMode = CONFIG.VIEW_MODES.GRID;
        this.sortBy = 'name';
        this.sortOrder = 'asc';
        this.searchTerm = '';
        this.storageInfo = null;
        this.importantFiles = new Set();
        this.recentFiles = [];
        this.downloadInProgress = false;
        this.isDownloading = false;

        this.initializeFileManager();
    }

    // Initialize file manager with better loading state management
    initializeFileManager() {
        console.log('🚀 Initializing File Manager...');

        // Show initial loading state
        this.showInitialLoadingState();

        this.loadPreferences();
        this.setupEventListeners();
        this.setupModalEventListeners();
        this.setupDragAndDrop();
        this.loadImportantFiles();
        this.loadRecentFiles();
        this.cleanupExpiredShares();

        // Check for shared file in URL
        this.checkForSharedFile();

        // Setup URL-based navigation
        this.setupUrlNavigation();

        // Wait for authentication before loading folders
        this.waitForAuthAndLoadFolder();
    }

    // Show initial loading state to prevent empty folder confusion
    showInitialLoadingState() {
        const fileList = document.getElementById('fileList');
        if (fileList) {
            fileList.innerHTML = `
                <div class="initial-loading-state">
                    <div class="loading-icon">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <div class="loading-text">
                        <h3>Philip Box 로딩 중...</h3>
                        <p>사용자 인증 및 파일 목록을 불러오고 있습니다.</p>
                    </div>
                </div>
            `;
        }

        console.log('✅ Initial loading state displayed');
    }

    // Wait for authentication and then load folder with better state management
    waitForAuthAndLoadFolder() {
        console.log('⏳ Waiting for authentication...');

        if (window.authManager && window.authManager.isInitialized()) {
            if (window.authManager.isAuthenticated()) {
                console.log('✅ Already authenticated, loading files immediately');
                this.loadInitialFolderFromUrl();
            } else {
                console.log('❌ Not authenticated, showing login');
                this.showNotAuthenticatedState();
            }
        } else {
            console.log('⏳ Auth manager not ready, waiting for auth-initialized event');

            // Wait for auth initialization with timeout
            const authTimeout = setTimeout(() => {
                console.warn('⚠️ Authentication timeout, showing login');
                this.showNotAuthenticatedState();
            }, 5000); // 5 second timeout

            document.addEventListener('auth-initialized', (event) => {
                clearTimeout(authTimeout);
                console.log('🔔 Auth-initialized event received:', event.detail);

                if (event.detail.authenticated) {
                    console.log('✅ User authenticated, loading files');
                    this.loadInitialFolderFromUrl();
                } else {
                    console.log('❌ User not authenticated, showing login');
                    this.showNotAuthenticatedState();
                }
            });
        }
    }

    // Show state when user is not authenticated
    showNotAuthenticatedState() {
        const fileList = document.getElementById('fileList');
        if (fileList) {
            fileList.innerHTML = `
                <div class="auth-required-state">
                    <div class="auth-icon">
                        <i class="fas fa-lock"></i>
                    </div>
                    <div class="auth-text">
                        <h3>로그인이 필요합니다</h3>
                        <p>파일에 접근하려면 먼저 로그인하세요.</p>
                    </div>
                </div>
            `;
        }

        console.log('🔒 Not authenticated state displayed');
    }

    // Setup URL-based navigation
    setupUrlNavigation() {
        // Listen for browser back/forward button
        window.addEventListener('popstate', (event) => {
            console.log('🔄 Popstate event triggered:', event.state);

            if (event.state && event.state.path) {
                console.log('🚀 Navigating to path from history:', event.state.path);

                // Navigate without updating URL (to prevent history loop)
                this.navigateToFolder(event.state.path, false);
            } else {
                console.log('🏠 No state found, navigating to root');

                // Navigate to root if no state
                this.navigateToFolder('/', false);
            }
        });
    }

    // Load initial folder from URL
    loadInitialFolderFromUrl() {
        // Only load from URL if we're not processing a shared file
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.get('share')) {
            this.loadFolderFromUrl();
        }
    }

    // Load folder from URL parameters
    loadFolderFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const pathParam = urlParams.get('path');
        const sectionParam = urlParams.get('section');

        // Handle section parameter
        if (sectionParam && sectionParam !== this.currentSection) {
            this.switchSection(sectionParam, false); // false = don't update URL
        }

        // Enhanced URL parameter loading
        const currentUrlParams = new URLSearchParams(window.location.search);
        const currentPathParam = currentUrlParams.get('path');

        console.log('🔗 URL parameters check - path:', currentPathParam);

        if (currentPathParam) {
            console.log('🚀 Loading folder from URL parameter:', currentPathParam);

            // Decode path parameter
            const decodedPath = decodeURIComponent(currentPathParam);

            // Navigate to the path from URL (without updating URL again)
            this.navigateToFolder(decodedPath, false);
        } else {
            console.log('🏠 No path parameter, navigating to root');

            // Navigate to root if no path parameter
            this.navigateToFolder('/', false);
        }
    }

    // Update URL to reflect current path and section  
    updateUrl() {
        try {
            console.log('🔗 Updating URL - currentPath:', this.currentPath, 'currentSection:', this.currentSection);

            const params = new URLSearchParams();

            // Add path parameter if not root
            if (this.currentPath && this.currentPath !== '/') {
                params.set('path', this.currentPath);
            }

            // Add section parameter if not default
            if (this.currentSection && this.currentSection !== 'files') {
                params.set('section', this.currentSection);
            }

            // Construct new URL
            const baseUrl = window.location.origin + window.location.pathname;
            const queryString = params.toString();
            const newUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

            // Create state object for browser history
            const stateObj = {
                path: this.currentPath,
                section: this.currentSection,
                timestamp: Date.now()
            };

            // Only update if URL actually changed
            if (newUrl !== window.location.href) {
                console.log('✅ URL updating from:', window.location.href, 'to:', newUrl);
                window.history.pushState(stateObj, '', newUrl);

                // Dispatch custom event for URL change
                window.dispatchEvent(new CustomEvent('urlChanged', {
                    detail: { path: this.currentPath, section: this.currentSection }
                }));
            } else {
                console.log('📝 URL already matches current state');
            }

        } catch (error) {
            console.error('❌ Failed to update URL:', error);
        }
    }

    // Check for shared file in URL parameters
    checkForSharedFile() {
        // Check both URL parameter and hash
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const shareId = urlParams.get('share') || hashParams.get('share');

        if (shareId) {
            console.log('🔗 Found share ID in URL:', shareId);

            // Wait for app to fully load, then show shared file
            setTimeout(() => {
                this.loadAndDisplaySharedFile(shareId);
            }, 1000);
        }
    }

    // Load and display shared file with enhanced handling
    async loadAndDisplaySharedFile(shareId) {
        try {
            console.log('🔗 Loading shared file with ID:', shareId);

            // Get share data from localStorage
            const shareData = localStorage.getItem(`share_${shareId}`);

            if (!shareData) {
                Utils.showNotification('❌ 공유 링크가 유효하지 않습니다.', 'error');
                this.cleanUpShareUrl();
                return;
            }

            const parsedShareData = JSON.parse(shareData);

            // Check if share is expired
            if (parsedShareData.expiry && new Date(parsedShareData.expiry) < new Date()) {
                Utils.showNotification('⏰ 공유 링크가 만료되었습니다.', 'error');
                this.cleanUpShareUrl();
                return;
            }

            // Update access count
            parsedShareData.accessCount = (parsedShareData.accessCount || 0) + 1;
            parsedShareData.lastAccessed = new Date().toISOString();
            localStorage.setItem(`share_${shareId}`, JSON.stringify(parsedShareData));

            // Create file object for preview with enhanced data
            const file = {
                id: parsedShareData.fileId,
                name: parsedShareData.fileName,
                size: parsedShareData.fileSize || 0,
                type: parsedShareData.fileType || 'application/octet-stream',
                path: parsedShareData.filePath,
                created: parsedShareData.createdAt,
                modified: parsedShareData.createdAt,
                isShared: true,
                shareId: shareId,
                thumbnail: parsedShareData.fileData?.thumbnail,
                shareData: parsedShareData
            };

            console.log('✅ Shared file data loaded:', {
                name: file.name,
                size: file.size,
                shareId: shareId
            });

            // Show success notification
            Utils.showNotification(`📂 공유된 파일 "${file.name}"을 열었습니다.`, 'success');

            // Show preview immediately
            this.showSharedFilePreview(file);

            // Clean up URL
            this.cleanUpShareUrl();

        } catch (error) {
            console.error('❌ Failed to load shared file:', error);
            Utils.showNotification('❌ 공유된 파일을 불러오는데 실패했습니다.', 'error');
            this.cleanUpShareUrl();
        }
    }

    // Show shared file preview
    showSharedFilePreview(file) {
        console.log('🎭 Showing shared file preview for:', file.name);

        // Wait for preview manager to be ready
        const showPreview = () => {
            if (window.previewManager && typeof window.previewManager.showPreview === 'function') {
                window.previewManager.showPreview(file);
                console.log('✅ Shared file preview shown');
            } else {
                console.warn('⚠️ Preview manager not available, trying again...');
                setTimeout(showPreview, 500);
            }
        };

        // Show preview after short delay to ensure UI is ready
        setTimeout(showPreview, 200);
    }

    // Clean up share URL from address bar
    cleanUpShareUrl() {
        try {
            // Remove share parameter from URL without refreshing page
            const newUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            console.log('🧹 Share URL cleaned up');
        } catch (error) {
            console.error('⚠️ Failed to clean up share URL:', error);
        }
    }

    // Enhanced test share link with better validation
    testShareLink() {
        const shareModal = document.getElementById('shareModal');
        const shareLink = document.getElementById('shareLink');

        if (!shareLink.value) {
            Utils.showNotification('❌ 공유 링크가 생성되지 않았습니다.', 'error');
            return;
        }

        console.log('🧪 Testing CORRECTED share link:', shareLink.value);

        // Validate that this is a valid share link
        if (!shareLink.value.includes('share.html')) {
            Utils.showNotification('❌ 유효한 공유 링크가 아닙니다. 다시 생성해주세요.', 'error');
            return;
        }

        // Extract share ID from URL
        let shareId = null;

        if (shareLink.value.includes('?share=')) {
            shareId = shareLink.value.split('?share=')[1].split('&')[0];
        }

        if (!shareId) {
            Utils.showNotification('❌ 유효하지 않은 공유 링크입니다.', 'error');
            return;
        }

        // Check if share data exists
        const shareData = localStorage.getItem(`share_${shareId}`);
        if (!shareData) {
            Utils.showNotification('❌ 공유 데이터를 찾을 수 없습니다.', 'error');
            return;
        }

        // Validate share data
        try {
            const parsedData = JSON.parse(shareData);
            if (!parsedData.fileName || !parsedData.fileData) {
                throw new Error('공유 데이터가 불완전합니다.');
            }

            console.log('✅ CORRECTED share link validation successful:', {
                shareId: shareId,
                fileName: parsedData.fileName,
                url: shareLink.value,
                isValid: true
            });

            // Open share link in new tab
            window.open(shareLink.value, '_blank');
            Utils.showNotification('✅ 공유 링크가 새 탭에서 열렸습니다.');

        } catch (error) {
            console.error('❌ Share validation failed:', error);
            Utils.showNotification('❌ 공유 데이터 검증에 실패했습니다.', 'error');
        }
    }

    // Load user preferences
    loadPreferences() {
        const preferences = Utils.getPreferences();
        this.viewMode = preferences.viewMode || CONFIG.VIEW_MODES.GRID;
        this.sortBy = preferences.sortBy || 'name';
        this.sortOrder = preferences.sortOrder || 'asc';

        this.updateViewMode();
    }

    // Save preferences
    savePreferences() {
        Utils.savePreferences({
            viewMode: this.viewMode,
            sortBy: this.sortBy,
            sortOrder: this.sortOrder
        });
    }

    // Load important files
    loadImportantFiles() {
        const importantFiles = localStorage.getItem(CONFIG.STORAGE_KEYS.IMPORTANT_FILES);
        if (importantFiles) {
            this.importantFiles = new Set(JSON.parse(importantFiles));
        }
    }

    // Save important files
    saveImportantFiles() {
        localStorage.setItem(
            CONFIG.STORAGE_KEYS.IMPORTANT_FILES,
            JSON.stringify(Array.from(this.importantFiles))
        );
    }

    // Load recent files
    loadRecentFiles() {
        const recentFiles = localStorage.getItem(CONFIG.STORAGE_KEYS.RECENT_FILES);
        if (recentFiles) {
            this.recentFiles = JSON.parse(recentFiles);
        }
    }

    // Save recent files
    saveRecentFiles() {
        localStorage.setItem(
            CONFIG.STORAGE_KEYS.RECENT_FILES,
            JSON.stringify(this.recentFiles)
        );
    }

    // Add to recent files
    addToRecentFiles(file) {
        // Remove if already exists
        this.recentFiles = this.recentFiles.filter(f => f.id !== file.id);

        // Add to beginning
        this.recentFiles.unshift({
            ...file,
            accessedAt: new Date().toISOString()
        });

        // Keep only last 50 files
        this.recentFiles = this.recentFiles.slice(0, 50);

        this.saveRecentFiles();
    }

    // Load shared files from localStorage
    loadSharedFiles() {
        const sharedFiles = [];

        try {
            // Load from file_shares
            const fileShares = localStorage.getItem('file_shares');
            if (fileShares) {
                const shares = JSON.parse(fileShares);
                console.log('Loaded file shares:', shares);

                for (const [fileId, shareInfo] of Object.entries(shares)) {
                    // Check if share is still valid (not expired)
                    if (shareInfo.expiry && new Date(shareInfo.expiry) < new Date()) {
                        console.log('Share expired for file:', fileId);
                        continue;
                    }

                    const file = shareInfo.file;
                    if (file) {
                        sharedFiles.push({
                            ...file,
                            shareInfo: shareInfo,
                            sharedAt: shareInfo.createdAt,
                            shareType: shareInfo.shareType,
                            shareUrl: shareInfo.shareUrl,
                            permissions: shareInfo.permissions
                        });
                    }
                }
            }

            // Also load individual share items
            const allKeys = Object.keys(localStorage);
            for (const key of allKeys) {
                if (key.startsWith('share_')) {
                    try {
                        const shareInfo = JSON.parse(localStorage.getItem(key));
                        if (shareInfo && shareInfo.fileName) {
                            // Check if share is still valid (not expired)
                            if (shareInfo.expiry && new Date(shareInfo.expiry) < new Date()) {
                                console.log('Individual share expired:', key);
                                continue;
                            }

                            // Check if this share is already included
                            const existingFile = sharedFiles.find(f => f.id === shareInfo.fileId);
                            if (!existingFile) {
                                sharedFiles.push({
                                    id: shareInfo.fileId || key,
                                    name: shareInfo.fileName,
                                    size: shareInfo.size || 0,
                                    type: shareInfo.type || 'file',
                                    mimeType: shareInfo.mimeType || 'application/octet-stream',
                                    modified: shareInfo.createdAt,
                                    created: shareInfo.createdAt,
                                    shareInfo: shareInfo,
                                    sharedAt: shareInfo.createdAt,
                                    shareType: shareInfo.shareType,
                                    shareUrl: `${window.location.origin}/share/${key.replace('share_', '')}`,
                                    permissions: shareInfo.permissions
                                });
                            }
                        }
                    } catch (error) {
                        console.error('Error loading individual share:', key, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading shared files:', error);
        }

        console.log('Loaded shared files:', sharedFiles);
        return sharedFiles;
    }

    // Save shared files info
    saveSharedFiles() {
        // This is handled by storeShareInfo method
        console.log('Shared files are saved automatically when creating shares');
    }

    // Remove expired shares
    cleanupExpiredShares() {
        try {
            const now = new Date();

            // Clean up file_shares
            const fileShares = localStorage.getItem('file_shares');
            if (fileShares) {
                const shares = JSON.parse(fileShares);
                const cleanedShares = {};

                for (const [fileId, shareInfo] of Object.entries(shares)) {
                    if (!shareInfo.expiry || new Date(shareInfo.expiry) > now) {
                        cleanedShares[fileId] = shareInfo;
                    }
                }

                localStorage.setItem('file_shares', JSON.stringify(cleanedShares));
            }

            // Clean up individual shares
            const allKeys = Object.keys(localStorage);
            for (const key of allKeys) {
                if (key.startsWith('share_')) {
                    try {
                        const shareInfo = JSON.parse(localStorage.getItem(key));
                        if (shareInfo && shareInfo.expiry && new Date(shareInfo.expiry) < now) {
                            localStorage.removeItem(key);
                        }
                    } catch (error) {
                        console.error('Error cleaning up share:', key, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error cleaning up expired shares:', error);
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Navigation
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchSection(item.dataset.section);
            });
        });

        // View mode buttons
        const gridViewBtn = document.getElementById('gridViewBtn');
        const listViewBtn = document.getElementById('listViewBtn');

        if (gridViewBtn) {
            gridViewBtn.addEventListener('click', () => {
                this.setViewMode(CONFIG.VIEW_MODES.GRID);
            });
        }

        if (listViewBtn) {
            listViewBtn.addEventListener('click', () => {
                this.setViewMode(CONFIG.VIEW_MODES.LIST);
            });
        }

        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchFiles(e.target.value);
            }, CONFIG.APP_CONFIG.SEARCH_CONFIG.searchDelay));
        }

        // AI Search button
        const searchAIBtn = document.getElementById('searchAIBtn');
        if (searchAIBtn) {
            searchAIBtn.addEventListener('click', () => {
                this.showAISearchModal();
            });
        }

        // Create folder button
        const createFolderBtn = document.getElementById('createFolderBtn');
        if (createFolderBtn) {
            createFolderBtn.addEventListener('click', () => {
                this.showCreateFolderDialog();
            });
        }

        // Upload button
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                this.triggerFileUpload();
            });
        }

        // Context menu
        this.setupContextMenu();

        // Modal event listeners
        this.setupModalEventListeners();
    }

    // Setup modal event listeners
    setupModalEventListeners() {
        // Preview modal
        const previewModal = document.getElementById('previewModal');
        const previewModalClose = document.getElementById('previewModalClose');
        
        if (previewModalClose) {
            previewModalClose.addEventListener('click', () => {
                previewModal.style.display = 'none';
            });
        }
        
        // Click outside to close
        if (previewModal) {
            previewModal.addEventListener('click', (e) => {
                if (e.target === previewModal) {
                    previewModal.style.display = 'none';
                }
            });
        }
        
        // File details modal
        const fileDetailsModal = document.getElementById('fileDetailsModal');
        const fileDetailsModalClose = document.getElementById('fileDetailsModalClose');
        
        if (fileDetailsModalClose) {
            fileDetailsModalClose.addEventListener('click', () => {
                fileDetailsModal.style.display = 'none';
            });
        }
        
        if (fileDetailsModal) {
            fileDetailsModal.addEventListener('click', (e) => {
                if (e.target === fileDetailsModal) {
                    fileDetailsModal.style.display = 'none';
                }
            });
        }
        
        // Create folder modal
        const createFolderModal = document.getElementById('createFolderModal');
        const createFolderModalClose = document.getElementById('createFolderModalClose');
        const createFolderForm = document.getElementById('createFolderForm');
        const cancelFolderBtn = document.getElementById('cancelFolderBtn');
        
        if (createFolderModalClose) {
            createFolderModalClose.addEventListener('click', () => {
                createFolderModal.style.display = 'none';
            });
        }
        
        if (cancelFolderBtn) {
            cancelFolderBtn.addEventListener('click', () => {
                createFolderModal.style.display = 'none';
            });
        }
        
        if (createFolderModal) {
            createFolderModal.addEventListener('click', (e) => {
                if (e.target === createFolderModal) {
                    createFolderModal.style.display = 'none';
                }
            });
        }
        
        // Create folder form submission
        if (createFolderForm) {
            createFolderForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const folderNameInput = document.getElementById('folderName');
                const folderName = folderNameInput?.value.trim();
                
                if (folderName) {
                    this.createFolder(folderName);
                    createFolderModal.style.display = 'none';
                }
            });
        }
    }

    // Setup drag and drop
    setupDragAndDrop() {
        const fileContainer = document.getElementById('fileContainer');
        if (!fileContainer) return;

        let dragCounter = 0;

        fileContainer.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            fileContainer.classList.add('drag-over');
        });

        fileContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                fileContainer.classList.remove('drag-over');
            }
        });

        fileContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        fileContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            fileContainer.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                window.uploadManager.handleFileUpload(files);
            }
        });
    }

    // Setup context menu
    setupContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;

        // Context menu items
        const openFile = document.getElementById('openFile');
        const downloadFile = document.getElementById('downloadFile');
        const shareFile = document.getElementById('shareFile');
        const fileDetails = document.getElementById('fileDetails');
        const renameFile = document.getElementById('renameFile');
        const moveFile = document.getElementById('moveFile');
        const toggleImportant = document.getElementById('toggleImportant');
        const deleteFile = document.getElementById('deleteFile');

        if (openFile) {
            openFile.addEventListener('click', () => {
                this.openSelectedFile();
                this.hideContextMenu();
            });
        }

        if (downloadFile) {
            downloadFile.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.downloadSelectedFilesSafely();
                this.hideContextMenu();
            });
        }

        if (shareFile) {
            shareFile.addEventListener('click', () => {
                this.shareSelectedFiles();
                this.hideContextMenu();
            });
        }

        if (fileDetails) {
            fileDetails.addEventListener('click', () => {
                this.showFileDetails();
                this.hideContextMenu();
            });
        }

        if (renameFile) {
            renameFile.addEventListener('click', () => {
                this.renameSelectedFile();
                this.hideContextMenu();
            });
        }

        if (moveFile) {
            moveFile.addEventListener('click', () => {
                this.moveSelectedFiles();
                this.hideContextMenu();
            });
        }

        if (toggleImportant) {
            toggleImportant.addEventListener('click', () => {
                this.toggleSelectedFileImportant();
                this.hideContextMenu();
            });
        }

        if (deleteFile) {
            deleteFile.addEventListener('click', () => {
                this.deleteSelectedFiles();
                this.hideContextMenu();
            });
        }

        // Hide context menu when clicking outside
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });
    }

    // Load files with improved loading state management
    async loadFiles(path = this.currentPath) {
        try {
            console.log('📂 Loading files for path:', path, 'section:', this.currentSection);

            // Show loading only if not in initial loading state
            const fileList = document.getElementById('fileList');
            const isInitialLoad = fileList && fileList.innerHTML.includes('initial-loading-state');

            if (!isInitialLoad) {
                Utils.showLoading(true);
            }

            // Handle different sections
            if (this.currentSection === CONFIG.FILE_SECTIONS.SHARED) {
                // Load shared files from localStorage
                this.cleanupExpiredShares(); // Clean up expired shares first
                this.currentFiles = this.loadSharedFiles();
                this.currentPath = '/'; // Reset path for shared section

                this.renderFiles();
                this.updateBreadcrumb();
                console.log('✅ Shared files loaded:', this.currentFiles.length);
                return;
            }

            if (this.currentSection === CONFIG.FILE_SECTIONS.RECENT) {
                // Load recent files from localStorage
                this.currentFiles = this.recentFiles.slice(0, 50); // Show last 50 recent files
                this.currentPath = '/'; // Reset path for recent section

                this.renderFiles();
                this.updateBreadcrumb();
                console.log('✅ Recent files loaded:', this.currentFiles.length);
                return;
            }

            if (this.currentSection === CONFIG.FILE_SECTIONS.IMPORTANT) {
                // Load important files from localStorage
                this.currentFiles = this.getAllStoredFiles().filter(file =>
                    this.importantFiles.has(file.id)
                );
                this.currentPath = '/'; // Reset path for important section

                this.renderFiles();
                this.updateBreadcrumb();
                console.log('✅ Important files loaded:', this.currentFiles.length);
                return;
            }

            if (this.currentSection === CONFIG.FILE_SECTIONS.DELETED) {
                // Load deleted files from localStorage
                this.currentFiles = JSON.parse(localStorage.getItem('deleted_files') || '[]');
                this.currentPath = '/'; // Reset path for deleted section

                this.renderFiles();
                this.updateBreadcrumb();
                console.log('✅ Deleted files loaded:', this.currentFiles.length);
                return;
            }

            // For main FILES section, load both API and local files
            this.currentPath = path;
            this.currentFiles = [];

            // Try to load from API first
            try {
                const response = await Utils.apiRequest(`${CONFIG.API_ENDPOINTS.files.list}?path=${encodeURIComponent(path)}`);
                if (response && response.files) {
                    this.currentFiles = response.files;
                    console.log('✅ Files loaded from API:', this.currentFiles.length);
                }
            } catch (error) {
                console.warn('API load failed, using local storage:', error);
            }

            // Always load and merge local files
            const localFiles = this.getStoredFilesForPath(path);
            console.log('📁 Loading local files for path:', path, 'found:', localFiles.length);

            // Merge API files with local files (remove duplicates by name)
            const existingFileNames = new Set(this.currentFiles.map(f => f.name));
            const uniqueLocalFiles = localFiles.filter(file => !existingFileNames.has(file.name));

            this.currentFiles = [...this.currentFiles, ...uniqueLocalFiles];

            // Sort files
            this.currentFiles.sort((a, b) => {
                // Sort folders first, then files
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;

                // Then sort by name
                return a.name.localeCompare(b.name);
            });

            console.log('✅ Total files loaded:', this.currentFiles.length, 'for path:', path);

            this.renderFiles();
            this.updateBreadcrumb();

        } catch (error) {
            console.error('❌ Failed to load files:', error);

            // Show error state instead of empty state
            this.showErrorState('파일을 불러오는데 실패했습니다.');

            // Fallback to local files only
            try {
                this.currentFiles = this.getStoredFilesForPath(path);
                console.log('📁 Fallback to local files:', this.currentFiles.length);
                this.renderFiles();
                this.updateBreadcrumb();
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
            }
        } finally {
            if (!isInitialLoad) {
                Utils.showLoading(false);
            }
        }
    }

    // Show error state for loading failures
    showErrorState(message) {
        const fileList = document.getElementById('fileList');
        if (fileList) {
            fileList.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="error-text">
                        <h3>로딩 실패</h3>
                        <p>${message}</p>
                        <button onclick="window.fileManager.loadFiles()" class="retry-btn">
                            <i class="fas fa-redo"></i> 다시 시도
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Get all stored files from localStorage
    getAllStoredFiles() {
        const storedFiles = JSON.parse(localStorage.getItem('stored_files') || '[]');
        return storedFiles.map(file => ({
            ...file,
            isLocal: true
        }));
    }

    // Get stored files for specific path
    getStoredFilesForPath(path) {
        const allFiles = this.getAllStoredFiles();

        // Normalize path
        const normalizedPath = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

        console.log('🔍 ===== getStoredFilesForPath 디버깅 =====');
        console.log('📁 요청된 경로:', path);
        console.log('📐 정규화된 경로:', normalizedPath);
        console.log('📊 전체 파일 수:', allFiles.length);

        // Filter files by path
        const filesInPath = allFiles.filter(file => {
            const filePath = (file.path || '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
            const pathsMatch = filePath === normalizedPath;
            
            // 🔥 FIXED: 상세한 디버깅 로그
            if (!pathsMatch) {
                console.log(`  ❌ 경로 불일치: "${file.name}" - 파일경로:"${filePath}" vs 요청경로:"${normalizedPath}"`);
            } else {
                console.log(`  ✅ 경로 일치: "${file.name}" - "${filePath}"`);
            }
            
            return pathsMatch;
        });

        console.log('📂 필터링 결과:', filesInPath.length, '개 파일/폴더');
        filesInPath.forEach(file => {
            console.log(`  📄 ${file.isFolder ? '📁' : '📄'} ${file.name} (경로: ${file.path})`);
        });
        console.log('🔍 ===== getStoredFilesForPath 디버깅 끝 =====');

        return filesInPath;
    }

    // Load storage info
    async loadStorageInfo() {
        try {
            const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.storage.usage);
            this.storageInfo = response;
            this.updateStorageUI();
        } catch (error) {
            console.error('Failed to load storage info:', error);
        }
    }

    // Render files
    renderFiles() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        // Filter files based on search term
        let filteredFiles = this.currentFiles;
        if (this.searchTerm) {
            filteredFiles = this.currentFiles.filter(file =>
                file.name.toLowerCase().includes(this.searchTerm.toLowerCase())
            );
        }

        // Sort files
        filteredFiles.sort((a, b) => {
            const aValue = a[this.sortBy];
            const bValue = b[this.sortBy];

            if (this.sortOrder === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });

        // Clear existing files
        fileList.innerHTML = '';

        if (filteredFiles.length === 0) {
            this.renderEmptyState();
            return;
        }

        // Render each file
        filteredFiles.forEach(file => {
            const fileElement = this.createFileElement(file);
            fileList.appendChild(fileElement);
        });
    }

    // Create file element
    createFileElement(file) {
            const fileElement = document.createElement('div');
            fileElement.className = `file-item ${this.viewMode}`;
            fileElement.dataset.fileId = file.id;

            const isImportant = this.importantFiles.has(file.id);
            const isShared = file.shareInfo || file.shareUrl;
            const fileIcon = this.getFileIcon(file);
            const fileSize = Utils.formatFileSize(file.size);
            const fileDate = Utils.formatDate(file.modified || file.created);

            // 🔥 Generate file URL if not exists
            const fileUrl = file.fileUrl || `${window.location.origin}/file/${file.id}`;

            // Generate thumbnail if supported
            const thumbnailHtml = this.generateThumbnailHtml(file);

            // Create share indicator
            let shareIndicator = '';
            if (isShared) {
                const shareType = file.shareType || 'private';
                const shareIcon = shareType === 'public' ? 'fas fa-globe' : 'fas fa-lock';
                shareIndicator = `<i class="share-indicator ${shareIcon}" title="공유됨 (${shareType === 'public' ? '공개' : '제한된'})"></i>`;
            }

            // Create file info with share details
            let fileInfoHtml = `
            <div class="file-info">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-meta">
                    <span class="file-size">${fileSize}</span>
                    <span class="file-date">${fileDate}</span>
                    ${isShared && this.currentSection === CONFIG.FILE_SECTIONS.SHARED ? 
                        `<span class="share-date">공유일: ${Utils.formatDate(file.sharedAt)}</span>` : ''}
                </div>
                ${isShared && this.currentSection === CONFIG.FILE_SECTIONS.SHARED ? 
                    `<div class="share-details">
                        <span class="share-type">${file.shareType === 'public' ? '공개 공유' : '제한된 공유'}</span>
                        <span class="share-permissions">${file.permissions === 'edit' ? '편집 가능' : '읽기 전용'}</span>
                    </div>` : ''}
                <div class="file-url">
                    <input type="text" value="${fileUrl}" readonly class="file-url-input" id="url-${file.id}">
                    <button class="btn-icon copy-url-btn" title="URL 복사" onclick="event.stopPropagation(); window.fileManager.copyFileUrl('${file.id}', '${fileUrl}')">
                        <i class="fas fa-link"></i>
                    </button>
                </div>
            </div>
        `;

        // Create action buttons
        let actionButtons = '';
        if (isShared && this.currentSection === CONFIG.FILE_SECTIONS.SHARED) {
            actionButtons = `
                <div class="file-actions">
                    <button class="btn-icon" title="공유 링크 복사" onclick="event.stopPropagation(); window.fileManager.copyShareLinkDirect('${file.shareUrl}')">
                        <i class="fas fa-link"></i>
                    </button>
                    <button class="btn-icon" title="공유 링크 테스트" onclick="event.stopPropagation(); window.fileManager.testShareLinkDirect('${file.shareUrl}')">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button class="btn-icon" title="공유 취소" onclick="event.stopPropagation(); window.fileManager.revokeShare('${file.id}')">
                        <i class="fas fa-share-alt-square"></i>
                    </button>
                    <button class="btn-icon" title="파일 URL 복사" onclick="event.stopPropagation(); window.fileManager.copyFileUrl('${file.id}', '${fileUrl}')">
                        <i class="fas fa-link"></i>
                    </button>
                    <button class="btn-icon" title="다운로드" onclick="event.stopPropagation(); event.preventDefault(); window.fileManager.downloadFileSecurely(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            `;
        } else {
            actionButtons = `
                <div class="file-actions">
                    <button class="btn-icon" title="파일 URL 복사" onclick="event.stopPropagation(); window.fileManager.copyFileUrl('${file.id}', '${fileUrl}')">
                        <i class="fas fa-link"></i>
                    </button>
                    <button class="btn-icon" title="다운로드" onclick="event.stopPropagation(); event.preventDefault(); window.fileManager.downloadFileSecurely(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon" title="공유" onclick="event.stopPropagation(); window.fileManager.showShareModal(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="btn-icon" title="중요 표시" onclick="event.stopPropagation(); window.fileManager.toggleFileImportant('${file.id}')">
                        <i class="fas ${isImportant ? 'fa-star' : 'fa-star-o'}"></i>
                    </button>
                </div>
            `;
        }

        fileElement.innerHTML = `
            <div class="file-icon">
                ${thumbnailHtml || `<i class="${fileIcon}"></i>`}
                ${isImportant ? '<i class="important-star fas fa-star"></i>' : ''}
                ${shareIndicator}
            </div>
            ${fileInfoHtml}
            ${actionButtons}
        `;

        // Add event listeners
        fileElement.addEventListener('click', (e) => {
            this.handleFileClick(file, e);
        });

        fileElement.addEventListener('dblclick', (e) => {
            this.handleFileDoubleClick(file);
        });

        fileElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.selectFile(file);
            this.showContextMenu(e, file);
        });

        return fileElement;
    }

    // 🔥 NEW: Copy file URL to clipboard
    async copyFileUrl(fileId, fileUrl) {
        try {
            console.log('Copying file URL:', fileUrl);
            
            await navigator.clipboard.writeText(fileUrl);
            Utils.showNotification(`📎 파일 URL이 복사되었습니다.`, 'success');
            
            // Visual feedback
            const copyBtn = document.querySelector(`#url-${fileId} + .copy-url-btn`);
            if (copyBtn) {
                const originalIcon = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyBtn.style.color = '#28a745';
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalIcon;
                    copyBtn.style.color = '';
                }, 2000);
            }
            
        } catch (error) {
            console.error('Copy URL failed:', error);
            
            // Fallback: select text for manual copy
            const urlInput = document.getElementById(`url-${fileId}`);
            if (urlInput) {
                urlInput.select();
                urlInput.setSelectionRange(0, 99999);
                
                try {
                    document.execCommand('copy');
                    Utils.showNotification('📎 파일 URL이 복사되었습니다. (수동 복사)', 'success');
                } catch (fallbackError) {
                    Utils.showNotification('URL 복사에 실패했습니다. 링크를 수동으로 복사해주세요.', 'error');
                }
            }
        }
    }

    // 🔥 NEW: Open file URL in new tab
    openFileUrl(fileUrl) {
        if (fileUrl) {
            window.open(fileUrl, '_blank');
            Utils.showNotification('📂 새 탭에서 파일을 열었습니다.', 'info');
        } else {
            Utils.showNotification('파일 URL이 없습니다.', 'error');
        }
    }

    // Generate thumbnail HTML with client-side generation
    generateThumbnailHtml(file) {
        if (!Utils.isThumbnailSupported(file.name)) {
            return null;
        }
        
        const extension = file.name.split('.').pop().toLowerCase();
        const thumbnailId = `thumb-${file.id}`;
        
        // Check if file has a real thumbnail stored
        if (file.thumbnail) {
            // Use the real thumbnail
            return `
                <div class="file-thumbnail" id="${thumbnailId}">
                    <img src="${file.thumbnail}" 
                         alt="${file.name}" 
                         loading="lazy"
                         onload="this.style.opacity=1"
                         onerror="this.parentElement.innerHTML='<i class=\\'fas fa-${extension === 'mp4' || extension === 'webm' || extension === 'ogg' ? 'video' : 'image'}\\'></i>'">
                </div>
            `;
        }
        
        // For demo purposes, create thumbnail placeholder
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) {
            // Image thumbnail
            const thumbnailHtml = `
                <div class="file-thumbnail image-thumbnail" id="${thumbnailId}">
                    <img src="${this.generateImageThumbnail(file)}" 
                         alt="${file.name}" 
                         loading="lazy"
                         onload="this.style.opacity=1"
                         onerror="this.style.display='none'">
                </div>
            `;
            return thumbnailHtml;
        } else if (['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(extension)) {
            // Video thumbnail
            const thumbnailHtml = `
                <div class="file-thumbnail video-thumbnail" id="${thumbnailId}">
                    <div class="video-thumbnail-placeholder">
                        <i class="fas fa-video"></i>
                        <span class="video-duration">${this.formatDuration(file.duration || 0)}</span>
                    </div>
                </div>
            `;
            return thumbnailHtml;
        }
        
        return null;
    }

    // Generate image thumbnail for demo purposes
    generateImageThumbnail(file) {
        // For demo purposes, create a placeholder image with file info
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 200;
        canvas.height = 150;
        
        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, 200, 150);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 200, 150);
        
        // Add file type icon
        ctx.fillStyle = 'white';
        ctx.font = '32px FontAwesome';
        ctx.textAlign = 'center';
        ctx.fillText('🖼️', 100, 70);
        
        // Add file name
        ctx.font = '12px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        const fileName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
        ctx.fillText(fileName, 100, 120);
        
        // Add file size
        ctx.font = '10px Arial';
        ctx.fillText(Utils.formatFileSize(file.size), 100, 135);
        
        return canvas.toDataURL();
    }

    // Generate video thumbnail placeholder
    generateVideoThumbnail(file) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 200;
        canvas.height = 150;
        
        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, 200, 150);
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(1, '#ee5a24');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 200, 150);
        
        // Add play button
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(80, 50);
        ctx.lineTo(80, 100);
        ctx.lineTo(120, 75);
        ctx.closePath();
        ctx.fill();
        
        // Add file name
        ctx.font = '12px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        const fileName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
        ctx.fillText(fileName, 100, 120);
        
        // Add file size
        ctx.font = '10px Arial';
        ctx.fillText(Utils.formatFileSize(file.size), 100, 135);
        
        return canvas.toDataURL();
    }

    // Format duration for videos
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Generate real thumbnail from file (for uploaded files)
    async generateRealThumbnail(file, fileObject) {
        console.log('🔥 FIREBASE STYLE - Real thumbnail generation started');
        console.log('  📄 File:', file.name);
        console.log('  📋 Type:', fileObject?.type);
        
        if (!fileObject || !Utils.isThumbnailSupported(file.name)) {
            console.log('❌ Thumbnail not supported or no file object:', file.name);
            return null;
        }
        
        const extension = file.name.split('.').pop().toLowerCase();
        const contentType = fileObject.type || 'application/octet-stream';
        
        // 🔥 Firebase 스타일: 이미지가 아니면 종료
        if (!contentType.startsWith('image/')) {
            console.log('❌ 이미지 파일이 아님:', contentType);
            return null;
        }
        
        // 🔥 Firebase 스타일: 썸네일 중복 방지
        if (file.name.includes('_thumb')) {
            console.log('❌ 이미 썸네일임:', file.name);
            return null;
        }
        
        try {
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) {
                console.log('🖼️ Firebase 스타일 이미지 썸네일 생성:', file.name);
                const thumbnail = await this.generateFirebaseStyleImageThumbnail(fileObject);
                console.log('✅ Firebase 스타일 이미지 썸네일 생성 완료:', file.name);
                return thumbnail;
            } else if (['mp4', 'webm', 'ogg'].includes(extension)) {
                console.log('🎬 Firebase 스타일 비디오 썸네일 생성:', file.name);
                const thumbnail = await this.generateFirebaseStyleVideoThumbnail(fileObject);
                console.log('✅ Firebase 스타일 비디오 썸네일 생성 완료:', file.name);
                return thumbnail;
            }
        } catch (error) {
            console.error('❌ Firebase 스타일 썸네일 생성 실패:', file.name, error);
            return null;
        }
        
        return null;
    }

    // 🔥 Firebase 스타일: Sharp와 유사한 고품질 이미지 썸네일 생성
    async generateFirebaseStyleImageThumbnail(fileObject) {
        return new Promise((resolve, reject) => {
            console.log('🔥 FIREBASE STYLE - Sharp-like image thumbnail generation');
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => {
                    console.log('📷 Original image size:', img.width, 'x', img.height);
                    
                    try {
                        // 🔥 Firebase Sharp 스타일: 200x200 리사이즈 (유지 비율)
                        const targetSize = 200;
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // 🔥 Sharp 스타일: 비율 유지하면서 리사이즈
                        let { width, height } = img;
                        
                        if (width > height) {
                            if (width > targetSize) {
                                height = (height * targetSize) / width;
                                width = targetSize;
                            }
                        } else {
                            if (height > targetSize) {
                                width = (width * targetSize) / height;
                                height = targetSize;
                            }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        
                        // 🔥 Sharp 스타일: 고품질 렌더링 설정
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        
                        // 🔥 Sharp 스타일: 이미지 그리기
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // 🔥 Firebase Sharp 스타일: JPEG 품질 80%
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        
                        console.log('✅ Firebase Sharp 스타일 썸네일 생성 완료');
                        console.log('  📐 Thumbnail size:', width, 'x', height);
                        console.log('  📊 Quality: 80%');
                        
                        resolve(dataUrl);
                    } catch (error) {
                        console.error('❌ Sharp 스타일 썸네일 생성 실패:', error);
                        reject(error);
                    }
                };
                
                img.onerror = (error) => {
                    console.error('❌ 이미지 로딩 실패:', error);
                    reject(new Error('Failed to load image'));
                };
                
                img.src = e.target.result;
            };
            
            reader.onerror = (error) => {
                console.error('❌ 파일 읽기 실패:', error);
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsDataURL(fileObject);
        });
    }

    // 🔥 Firebase 스타일: 비디오 썸네일 생성 (개선된 버전)
    async generateFirebaseStyleVideoThumbnail(fileObject) {
        return new Promise((resolve, reject) => {
            console.log('🔥 FIREBASE STYLE - Video thumbnail generation');
            
            const video = document.createElement('video');
            video.style.position = 'absolute';
            video.style.top = '-9999px';
            video.style.left = '-9999px';
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata';
            
            // Add to DOM temporarily
            document.body.appendChild(video);
            
            const cleanup = () => {
                try {
                    if (video.parentNode) {
                        document.body.removeChild(video);
                    }
                    if (video.src) {
                        URL.revokeObjectURL(video.src);
                    }
                } catch (e) {
                    console.error('❌ Cleanup error:', e);
                }
            };
            
            // 🔥 Firebase 스타일: 더 짧은 타임아웃 (효율성)
            const timeoutId = setTimeout(() => {
                console.warn('⚠️ Video thumbnail timeout');
                cleanup();
                reject(new Error('Video thumbnail generation timeout'));
            }, 5000);
            
            video.onloadedmetadata = () => {
                console.log('📹 Video metadata loaded, duration:', video.duration);
                // 🔥 Firebase 스타일: 1초 또는 10% 지점에서 썸네일 추출
                const seekTime = Math.min(1, video.duration * 0.1);
                video.currentTime = seekTime;
                console.log('⏰ Seeking to:', seekTime, 'seconds');
            };
            
            video.onseeked = () => {
                console.log('🎯 Video seek completed');
                
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 🔥 Firebase 스타일: 200x200 썸네일 (Sharp와 동일)
                    const targetSize = 200;
                    const aspectRatio = video.videoWidth / video.videoHeight;
                    
                    let width, height;
                    if (aspectRatio > 1) {
                        width = targetSize;
                        height = targetSize / aspectRatio;
                    } else {
                        width = targetSize * aspectRatio;
                        height = targetSize;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // 🔥 Sharp 스타일: 고품질 렌더링
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    // 🔥 비디오 프레임 그리기
                    ctx.drawImage(video, 0, 0, width, height);
                    
                    // 🔥 Firebase 스타일: JPEG 80% 품질
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    
                    console.log('✅ Firebase 스타일 비디오 썸네일 생성 완료');
                    console.log('  📐 Size:', width, 'x', height);
                    
                    clearTimeout(timeoutId);
                    cleanup();
                    resolve(dataUrl);
                } catch (error) {
                    console.error('❌ 비디오 썸네일 캔버스 생성 실패:', error);
                    clearTimeout(timeoutId);
                    cleanup();
                    reject(error);
                }
            };
            
            video.onerror = (error) => {
                console.error('❌ 비디오 로딩 실패:', error);
                clearTimeout(timeoutId);
                cleanup();
                reject(new Error('Failed to load video'));
            };
            
            // 🔥 Firebase 스타일: 비디오 소스 설정
            try {
                const videoUrl = URL.createObjectURL(fileObject);
                video.src = videoUrl;
                console.log('🎬 Video source set, waiting for metadata...');
            } catch (error) {
                console.error('❌ 비디오 소스 설정 실패:', error);
                clearTimeout(timeoutId);
                cleanup();
                reject(error);
            }
        });
    }

    // Generate image thumbnail from actual file
    async generateImageThumbnailFromFile(fileObject) {
        // 🔥 Firebase 스타일 사용
        return this.generateFirebaseStyleImageThumbnail(fileObject);
    }

    // Generate video thumbnail from actual file
    async generateVideoThumbnailFromFile(fileObject) {
        // 🔥 Firebase 스타일 사용
        return this.generateFirebaseStyleVideoThumbnail(fileObject);
    }

    // Get file icon
    getFileIcon(file) {
        if (file.type === 'folder') {
            return CONFIG.FILE_TYPE_ICONS.folder;
        }

        const extension = file.name.split('.').pop().toLowerCase();
        return CONFIG.FILE_TYPE_ICONS[extension] || CONFIG.FILE_TYPE_ICONS.default;
    }

    // Handle file click
    handleFileClick(file, event) {
        if (event.ctrlKey || event.metaKey) {
            this.toggleFileSelection(file);
        } else {
            this.selectFile(file);
        }
    }

    // Handle file double click with enhanced navigation
    handleFileDoubleClick(file) {
        console.log('🔍 ===== 파일 더블클릭 디버깅 시작 =====');
        console.log('🖱️ 더블클릭된 파일:', file.name);
        console.log('📋 파일 타입:', file.type);
        console.log('📁 isFolder:', file.isFolder);
        console.log('📁 현재 currentPath:', this.currentPath);
        console.log('📁 파일의 path:', file.path);
        
        // Check if it's a folder - support both isFolder and type properties
        const isFolder = file.isFolder === true || file.type === 'folder' || file.type === 'application/x-directory';
        
        if (isFolder) {
            console.log('📁 폴더 더블클릭 - 폴더 이동 시작');
            
            // 🔥 FIXED: 올바른 폴더 경로 생성
            // 현재 경로에서 선택된 폴더로 이동
            const newFolderPath = this.currentPath === '/' ? 
                '/' + file.name : 
                this.currentPath + '/' + file.name;
            
            console.log('🔧 폴더 경로 생성 (FIXED):');
            console.log('  📁 현재 경로:', this.currentPath);
            console.log('  📂 폴더명:', file.name);
            console.log('  📁 파일의 부모 경로:', file.path);
            console.log('  🎯 새로운 폴더 경로:', newFolderPath);
            
            // 🔥 FIXED: 경로 검증
            console.log('🔍 경로 검증:');
            console.log('  ✅ 폴더가 현재 경로에 있는가?', file.path === this.currentPath);
            
            console.log('🚀 navigateToFolder 호출 중...');
            
            // Navigate to folder with URL update
            this.navigateToFolder(newFolderPath, true);
        } else {
            console.log('📄 파일 더블클릭 - 미리보기 열기:', file.name);
            
            // Open file preview
            this.previewFile(file);
        }
        
        console.log('🔍 ===== 파일 더블클릭 디버깅 끝 =====');
    }

    // Open file
    openFile(file) {
        this.addToRecentFiles(file);
        this.previewFile(file);
    }

    // Open selected file
    openSelectedFile() {
        if (this.selectedFiles.length === 1) {
            this.openFile(this.selectedFiles[0]);
        }
    }

    // Select file
    selectFile(file) {
        this.selectedFiles = [file];
        this.updateFileSelection();
    }

    // Toggle file selection
    toggleFileSelection(file) {
        const index = this.selectedFiles.findIndex(f => f.id === file.id);
        if (index > -1) {
            this.selectedFiles.splice(index, 1);
        } else {
            this.selectedFiles.push(file);
        }
        this.updateFileSelection();
    }

    // Update file selection UI
    updateFileSelection() {
        const fileElements = document.querySelectorAll('.file-item');
        fileElements.forEach(element => {
            const fileId = element.dataset.fileId;
            const isSelected = this.selectedFiles.some(f => f.id === fileId);
            element.classList.toggle('selected', isSelected);
        });
    }

    // Navigate to folder with enhanced URL updating
    async navigateToFolder(path, updateUrl = true) {
        try {
            console.log('🔍 ===== 폴더 이동 디버깅 시작 =====');
            console.log('🚀 요청된 이동 경로:', path);
            console.log('🔗 URL 업데이트 여부:', updateUrl);
            console.log('📁 현재 currentPath (이동 전):', this.currentPath);
            
            // Validate path
            if (!path || typeof path !== 'string') {
                console.error('❌ Invalid path provided:', path);
                return;
            }
            
            // Normalize path
            const normalizedPath = path.startsWith('/') ? path : '/' + path;
            console.log('📐 정규화된 경로:', normalizedPath);
            
            // Update current path
            console.log('🔄 currentPath 업데이트 중...');
            console.log('  이전 값:', this.currentPath);
            this.currentPath = normalizedPath;
            console.log('  새로운 값:', this.currentPath);
            console.log('✅ currentPath 업데이트 완료');
            
            // getCurrentPath 함수 테스트
            if (this.getCurrentPath) {
                const testGetCurrentPath = this.getCurrentPath();
                console.log('🧪 getCurrentPath() 테스트 결과:', testGetCurrentPath);
            }
            
            // Update URL if requested
            if (updateUrl) {
                console.log('🔗 URL 업데이트 중...');
                this.updateUrl();
            }
            
            // Update breadcrumb
            console.log('🍞 Breadcrumb 업데이트 중...');
            this.updateBreadcrumb();
            
            // Load files for the new path
            console.log('📂 새 경로의 파일 로딩 중:', normalizedPath);
            await this.loadFiles(normalizedPath);
            
            // 🔥 FIXED: 폴더 이동 후 검증
            console.log('🔍 폴더 이동 검증:');
            const loadedFiles = this.getCurrentFiles();
            console.log('  📊 로드된 파일/폴더 수:', loadedFiles.length);
            console.log('  📂 로드된 항목들:');
            loadedFiles.forEach(file => {
                console.log(`    ${file.isFolder ? '📁' : '📄'} ${file.name} (경로: ${file.path})`);
            });
            
            // Update UI
            console.log('🖼️ UI 렌더링 중...');
            this.renderFiles();
            
            console.log('✅ 폴더 이동 완료:', normalizedPath);
            console.log('📁 최종 currentPath:', this.currentPath);
            console.log('🔍 ===== 폴더 이동 디버깅 끝 =====');
            
        } catch (error) {
            console.error('❌ Navigation failed:', error);
            Utils.showNotification('폴더 이동에 실패했습니다.', 'error');
        }
    }

    // Preview file
    previewFile(file) {
        if (window.previewManager) {
            window.previewManager.showPreview(file);
        }
    }

    // Show context menu
    showContextMenu(event, file) {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;

        // Update important button text
        const toggleImportant = document.getElementById('toggleImportant');
        if (toggleImportant) {
            const isImportant = this.importantFiles.has(file.id);
            toggleImportant.innerHTML = `
                <i class="fas ${isImportant ? 'fa-star' : 'fa-star-o'}"></i>
                ${isImportant ? '중요 해제' : '중요 표시'}
            `;
        }

        contextMenu.style.left = event.clientX + 'px';
        contextMenu.style.top = event.clientY + 'px';
        contextMenu.classList.add('active');
    }

    // Hide context menu
    hideContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) {
            contextMenu.classList.remove('active');
        }
    }

    // Download file securely (wrapper for UI buttons)
    async downloadFileSecurely(file) {
        console.log('🔥 Starting SECURE download for:', file.name);
        
        try {
            // Prevent any popup or navigation warnings
            window.isDownloading = true;
            
            // Create file content first
            const content = this.createFileContent(file);
            console.log('✓ File content created, length:', content.length);
            
            // Create download immediately
            this.triggerSecureDownload(file.name, content);
            
            // Show success notification
            Utils.showNotification(`✅ ${file.name} 다운로드 완료`, 'success');
            
            // Add to recent files
            this.addToRecentFiles(file);
            
            console.log('✅ Download completed successfully');
            
        } catch (error) {
            console.error('❌ Download failed:', error);
            Utils.showNotification(`❌ ${file.name} 다운로드 실패`, 'error');
        } finally {
            // Always reset download flag
            setTimeout(() => {
                window.isDownloading = false;
                console.log('🔄 Download flag reset');
            }, 3000);
        }
    }

    // Create file content (simple and reliable)
    createFileContent(file) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'txt';
        
        const basicInfo = `
📁 파일명: ${file.name}
📊 크기: ${Utils.formatFileSize(file.size || 1024)}
📅 생성일: ${file.created || new Date().toISOString()}
📝 수정일: ${file.modified || new Date().toISOString()}
🏷️ 타입: ${file.mimeType || 'Unknown'}

🌟 Philip Box 데모 파일입니다.
실제 애플리케이션에서는 여기에 실제 파일 내용이 표시됩니다.
        `.trim();

        switch (extension) {
            case 'txt':
                return basicInfo;
                
            case 'json':
                return JSON.stringify({
                    fileName: file.name,
                    size: file.size || 1024,
                    created: file.created || new Date().toISOString(),
                    modified: file.modified || new Date().toISOString(),
                    demo: true,
                    content: "Philip Box 데모 JSON 파일입니다."
                }, null, 2);
                
            case 'html':
                return `<!DOCTYPE html>
<html>
<head>
    <title>${file.name}</title>
    <meta charset="UTF-8">
</head>
<body>
    <h1>📁 ${file.name}</h1>
    <p>🌟 Philip Box 데모 HTML 파일입니다.</p>
    <pre>${basicInfo}</pre>
</body>
</html>`;

            case 'csv':
                return `파일명,크기,생성일,타입
${file.name},"${Utils.formatFileSize(file.size || 1024)}","${file.created || new Date().toISOString()}","${file.mimeType || 'Unknown'}"
데모파일1.txt,1024,"${new Date().toISOString()}",text/plain
데모파일2.json,2048,"${new Date().toISOString()}",application/json`;

            default:
                return basicInfo;
        }
    }

    // Trigger secure download (no navigation alerts)
    triggerSecureDownload(fileName, content) {
        console.log('🚀 Triggering secure download for:', fileName);
        
        try {
            // Determine MIME type
            const extension = fileName.split('.').pop()?.toLowerCase() || 'txt';
            const mimeType = this.getFileMimeType(extension);
            
            // Create blob with proper MIME type
            const blob = new Blob([content], { type: mimeType });
            console.log('✓ Blob created, size:', blob.size, 'type:', blob.type);
            
            // Create object URL
            const downloadUrl = URL.createObjectURL(blob);
            console.log('✓ Download URL created');
            
            // Create download element
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.download = fileName;
            downloadLink.style.cssText = 'display:none!important;position:absolute!important;left:-9999px!important;';
            
            // Add to document
            document.body.appendChild(downloadLink);
            console.log('✓ Download link added to DOM');
            
            // Force download
            downloadLink.click();
            console.log('✓ Download triggered');
            
            // Cleanup after short delay
            setTimeout(() => {
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(downloadUrl);
                console.log('✓ Download cleanup completed');
            }, 1000);
            
        } catch (error) {
            console.error('❌ Secure download failed:', error);
            throw error;
        }
    }

    // Get MIME type for file extension
    getFileMimeType(extension) {
        const mimeTypes = {
            'txt': 'text/plain; charset=utf-8',
            'html': 'text/html; charset=utf-8',
            'css': 'text/css; charset=utf-8',
            'js': 'application/javascript; charset=utf-8',
            'json': 'application/json; charset=utf-8',
            'xml': 'application/xml; charset=utf-8',
            'csv': 'text/csv; charset=utf-8',
            'md': 'text/markdown; charset=utf-8',
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'mp4': 'video/mp4',
            'mp3': 'audio/mpeg',
            'zip': 'application/zip'
        };
        
        return mimeTypes[extension] || 'application/octet-stream';
    }

    // Download file - 간단한 래퍼
    async downloadFile(file) {
        return this.downloadFileSecurely(file);
    }

    // Get MIME type for file extension
    getMimeType(fileName) {
        const extension = fileName.split('.').pop()?.toLowerCase() || 'txt';
        const mimeTypes = {
            'txt': 'text/plain',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'json': 'application/json',
            'xml': 'application/xml',
            'csv': 'text/csv',
            'md': 'text/markdown',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'mp4': 'video/mp4',
            'avi': 'video/x-msvideo',
            'mov': 'video/quicktime',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'zip': 'application/zip',
            'rar': 'application/vnd.rar',
            '7z': 'application/x-7z-compressed',
            'tar': 'application/x-tar',
            'gz': 'application/gzip'
        };
        
        return mimeTypes[extension] || 'application/octet-stream';
    }

    // Download selected files safely
    async downloadSelectedFilesSafely() {
        if (this.selectedFiles.length === 0) {
            Utils.showNotification('다운로드할 파일을 선택해주세요.', 'info');
            return;
        }

        try {
            // Download each selected file
            for (const file of this.selectedFiles) {
                await this.downloadFile(file);
                // Small delay between downloads to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            Utils.showNotification(`${this.selectedFiles.length}개 파일 다운로드 완료`, 'success');
            
        } catch (error) {
            console.error('Multiple download failed:', error);
            Utils.showNotification('일부 파일 다운로드에 실패했습니다.', 'error');
        }
    }

    // Download selected files
    async downloadSelectedFiles() {
        await this.downloadSelectedFilesSafely();
    }

    // Show share modal
    showShareModal(file) {
        const shareModal = document.getElementById('shareModal');
        const shareFileName = document.getElementById('shareFileName');
        const shareFileIcon = shareModal.querySelector('.share-file-icon i');
        
        if (shareModal && shareFileName && shareFileIcon) {
            shareFileName.textContent = file.name;
            shareFileIcon.className = this.getFileIcon(file);
            shareModal.dataset.fileId = file.id;
            
            // Check if file already has a share link
            const existingShares = JSON.parse(localStorage.getItem('file_shares') || '{}');
            const hasExistingShare = existingShares[file.id];
            
            if (hasExistingShare) {
                // Load existing share info
                const shareLink = document.getElementById('shareLink');
                shareLink.value = hasExistingShare.shareUrl;
                this.updateShareModalState(true);
                
                // Update form fields
                const shareTypeRadio = document.querySelector(`input[name="shareType"][value="${hasExistingShare.shareType}"]`);
                if (shareTypeRadio) shareTypeRadio.checked = true;
                
                const permissionsSelect = document.getElementById('sharePermissions');
                if (permissionsSelect) permissionsSelect.value = hasExistingShare.permissions;
                
                if (hasExistingShare.expiry) {
                    const expiryCheckbox = document.getElementById('shareExpiry');
                    const expiryDate = document.getElementById('shareExpiryDate');
                    if (expiryCheckbox) expiryCheckbox.checked = true;
                    if (expiryDate) {
                        expiryDate.disabled = false;
                        expiryDate.value = hasExistingShare.expiry.split('T')[0];
                    }
                }
            } else {
                // Initialize modal state for new share
                this.updateShareModalState(false);
                
                // Reset form fields
                const shareTypeRadio = document.querySelector('input[name="shareType"][value="private"]');
                if (shareTypeRadio) shareTypeRadio.checked = true;
                
                const permissionsSelect = document.getElementById('sharePermissions');
                if (permissionsSelect) permissionsSelect.value = 'view';
                
                const expiryCheckbox = document.getElementById('shareExpiry');
                const expiryDate = document.getElementById('shareExpiryDate');
                if (expiryCheckbox) expiryCheckbox.checked = false;
                if (expiryDate) {
                    expiryDate.disabled = true;
                    expiryDate.value = '';
                }
            }
            
            shareModal.style.display = 'block';
        }
    }

    // Share file (legacy method)
    async shareFile(file) {
        this.showShareModal(file);
    }

    // Share selected files
    async shareSelectedFiles() {
        if (this.selectedFiles.length === 0) return;

        if (this.selectedFiles.length === 1) {
            this.showShareModal(this.selectedFiles[0]);
        } else {
            Utils.showNotification('파일을 하나씩 공유해주세요.', 'info');
        }
    }

    // Generate share link
    async generateShareLink() {
        const shareModal = document.getElementById('shareModal');
        const fileId = shareModal.dataset.fileId;
        const shareType = document.querySelector('input[name="shareType"]:checked').value;
        const permissions = document.getElementById('sharePermissions').value;
        const expiry = document.getElementById('shareExpiry').checked;
        const expiryDate = document.getElementById('shareExpiryDate').value;

        try {
            Utils.showLoading(true);
            
            // Find the file info
            const file = this.currentFiles.find(f => f.id === fileId);
            if (!file) {
                throw new Error('파일을 찾을 수 없습니다.');
            }
            
            // Try API first, fallback to local generation
            let shareUrl;
            try {
                const response = await Utils.apiRequest(
                    CONFIG.API_ENDPOINTS.files.share,
                    'POST',
                    {
                        fileId: fileId,
                        type: shareType,
                        permissions: permissions,
                        expiry: expiry ? expiryDate : null
                    }
                );
                
                shareUrl = response.shareUrl;
                
                // 🔥 FIXED: 올바른 공유 URL 검증 로직
                if (shareUrl && (shareUrl.includes('/share/') || shareUrl.includes('/file/'))) {
                    // Valid share URL from API - 서버 도메인이 달라도 허용
                    console.log('✅ Using API share URL:', shareUrl);
                } else {
                    throw new Error('Invalid share URL from API');
                }
                
            } catch (apiError) {
                console.warn('API share failed, generating local share URL:', apiError);
                // Generate local share URL as fallback
                shareUrl = this.generateLocalShareUrl(file, shareType, permissions, expiry ? expiryDate : null);
            }

            const shareLink = document.getElementById('shareLink');
            shareLink.value = shareUrl;
            
            // Update UI state
            this.updateShareModalState(true);
            
            // Store share info locally for fallback access
            this.storeShareInfo(fileId, {
                shareUrl: shareUrl,
                shareType: shareType,
                permissions: permissions,
                expiry: expiry ? expiryDate : null,
                createdAt: new Date().toISOString(),
                file: {
                    id: file.id,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    mimeType: file.mimeType
                }
            });
            
            Utils.showNotification('공유 링크가 생성되었습니다.');
            
        } catch (error) {
            console.error('Share failed:', error);
            Utils.showNotification(`공유 링크 생성 실패: ${error.message}`, 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Generate local share URL with independent share page
    generateLocalShareUrl(file, shareType, permissions, expiry) {
        const shareId = this.generateShareToken();
        
        // 🔥 FIXED: 올바른 백엔드 도메인 사용 (API 경로 제거)
        const backendUrl = CONFIG.API_BASE_URL ? 
            CONFIG.API_BASE_URL.replace('/api', '') : 
            'https://philip-box.onrender.com';
        const shareUrl = `${backendUrl}/share/${shareId}`;
        
        console.log('🔗 Creating share URL:', shareUrl, 'for file:', file.name);
        console.log('🔗 Backend URL:', backendUrl);
        console.log('🔗 Original API_BASE_URL:', CONFIG.API_BASE_URL);
        
        // Store complete share information with enhanced data
        const shareData = {
            shareId: shareId,
            fileId: file.id,
            fileName: file.name,
            fileSize: file.size,
            filePath: file.path || this.getCurrentPath(),
            mimeType: file.mimeType || 'application/octet-stream',
            shareType: shareType,
            permissions: permissions,
            expiry: expiry,
            createdAt: new Date().toISOString(),
            createdBy: window.authManager?.getCurrentUser()?.email || 'demo-user',
            accessCount: 0,
            lastAccessed: null,
            // Store complete file data for independent sharing
            fileData: {
                id: file.id,
                name: file.name,
                size: file.size,
                type: file.type,
                mimeType: file.mimeType,
                path: file.path || this.getCurrentPath(),
                created: file.created,
                modified: file.modified,
                thumbnail: file.thumbnail,
                isShared: true,
                shareId: shareId,
                // Store ACTUAL file content for independent access
                content: this.createFileContent(file),
                // Store file as blob data for real download capability
                fileBlob: file.fileBlob || null
            }
        };
        
        // Store in localStorage with share ID
        localStorage.setItem(`share_${shareId}`, JSON.stringify(shareData));
        
        // Also store in file shares index
        const fileShares = JSON.parse(localStorage.getItem('file_shares') || '{}');
        fileShares[file.id] = {
            shareId: shareId,
            shareUrl: shareUrl,
            shareType: shareType,
            permissions: permissions,
            expiry: expiry,
            createdAt: new Date().toISOString(),
            file: file
        };
        localStorage.setItem('file_shares', JSON.stringify(fileShares));
        
        console.log('✅ Share created successfully:', {
            shareId: shareId,
            fileName: file.name,
            shareUrl: shareUrl,
            backendUrl: backendUrl
        });
        
        return shareUrl;
    }

    // Generate unique share token
    generateShareToken() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `${timestamp}_${random}`;
    }

    // Store share information with enhanced data
    storeShareInfo(fileId, shareInfo) {
        const existingShares = JSON.parse(localStorage.getItem('file_shares') || '{}');
        existingShares[fileId] = {
            ...shareInfo,
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('file_shares', JSON.stringify(existingShares));
        
        console.log('Share info stored for file:', fileId, shareInfo);
    }

    // Update share modal UI state
    updateShareModalState(hasLink) {
        const copyShareLink = document.getElementById('copyShareLink');
        const testShareLink = document.getElementById('testShareLink');
        const revokeShareLink = document.getElementById('revokeShareLink');
        const shareLinkNote = document.getElementById('shareLinkNote');
        const shareLink = document.getElementById('shareLink');

        if (hasLink) {
            copyShareLink.disabled = false;
            testShareLink.disabled = false;
            revokeShareLink.disabled = false;
            shareLinkNote.style.display = 'flex';
            shareLink.placeholder = '';
        } else {
            copyShareLink.disabled = true;
            testShareLink.disabled = true;
            revokeShareLink.disabled = true;
            shareLinkNote.style.display = 'none';
            shareLink.placeholder = '먼저 "링크 생성" 버튼을 클릭하세요';
            shareLink.value = '';
        }
    }

    // Copy share link
    async copyShareLink() {
        const shareLink = document.getElementById('shareLink');
        if (shareLink.value) {
            try {
                // 🔥 FIXED: 올바른 공유 URL 검증 로직
                if (shareLink.value === window.location.href) {
                    Utils.showNotification('잘못된 공유 링크입니다. 다시 생성해주세요.', 'error');
                    return;
                }
                
                // 공유 URL이 올바른 형식인지 확인
                if (!shareLink.value.includes('/share/') && !shareLink.value.includes('/file/')) {
                    Utils.showNotification('올바른 공유 링크 형식이 아닙니다.', 'error');
                    return;
                }
                
                await navigator.clipboard.writeText(shareLink.value);
                Utils.showNotification('공유 링크가 클립보드에 복사되었습니다.');
                
                // Log for debugging
                console.log('✅ Copied share link:', shareLink.value);
                
            } catch (error) {
                console.error('Clipboard copy failed:', error);
                
                // Fallback: select text for manual copy
                shareLink.select();
                shareLink.setSelectionRange(0, 99999); // For mobile devices
                
                try {
                    document.execCommand('copy');
                    Utils.showNotification('공유 링크가 복사되었습니다. (수동 복사)');
                } catch (fallbackError) {
                    Utils.showNotification('클립보드 복사에 실패했습니다. 링크를 수동으로 복사해주세요.', 'error');
                }
            }
        } else {
            Utils.showNotification('먼저 공유 링크를 생성해주세요.', 'error');
        }
    }

    // Test share link with better validation
    testShareLink() {
        const shareModal = document.getElementById('shareModal');
        const shareLink = document.getElementById('shareLink');
        
        if (!shareLink.value) {
            Utils.showNotification('❌ 공유 링크가 생성되지 않았습니다.', 'error');
            return;
        }
        
        console.log('🧪 Testing CORRECTED share link:', shareLink.value);
        
        // Validate that this is a valid share link
        if (!shareLink.value.includes('share.html')) {
            Utils.showNotification('❌ 유효한 공유 링크가 아닙니다. 다시 생성해주세요.', 'error');
            return;
        }
        
        // Extract share ID from URL
        let shareId = null;
        
        if (shareLink.value.includes('?share=')) {
            shareId = shareLink.value.split('?share=')[1].split('&')[0];
        }
        
        if (!shareId) {
            Utils.showNotification('❌ 유효하지 않은 공유 링크입니다.', 'error');
            return;
        }
        
        // Check if share data exists
        const shareData = localStorage.getItem(`share_${shareId}`);
        if (!shareData) {
            Utils.showNotification('❌ 공유 데이터를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // Validate share data
        try {
            const parsedData = JSON.parse(shareData);
            if (!parsedData.fileName || !parsedData.fileData) {
                throw new Error('공유 데이터가 불완전합니다.');
            }
            
            console.log('✅ CORRECTED share link validation successful:', {
                shareId: shareId,
                fileName: parsedData.fileName,
                url: shareLink.value,
                isValid: true
            });
            
            // Open share link in new tab
            window.open(shareLink.value, '_blank');
            Utils.showNotification('✅ 공유 링크가 새 탭에서 열렸습니다.');
            
        } catch (error) {
            console.error('❌ Share validation failed:', error);
            Utils.showNotification('❌ 공유 데이터 검증에 실패했습니다.', 'error');
        }
    }

    // Revoke share link
    async revokeShareLink() {
        const shareModal = document.getElementById('shareModal');
        const fileId = shareModal.dataset.fileId;
        const shareLink = document.getElementById('shareLink');

        if (!shareLink.value) {
            Utils.showNotification('취소할 공유 링크가 없습니다.', 'info');
            return;
        }

        const confirmed = confirm('정말로 이 파일의 공유를 취소하시겠습니까?\n취소하면 기존 링크로 더 이상 접근할 수 없습니다.');
        if (!confirmed) return;

        try {
            Utils.showLoading(true);
            
            // Try API first
            try {
                await Utils.apiRequest(
                    `${CONFIG.API_ENDPOINTS.files.share}/${fileId}`,
                    'DELETE'
                );
            } catch (apiError) {
                console.warn('API revoke failed, proceeding with local cleanup:', apiError);
            }
            
            // Clean up local storage
            const shares = JSON.parse(localStorage.getItem('file_shares') || '{}');
            delete shares[fileId];
            localStorage.setItem('file_shares', JSON.stringify(shares));
            
            // Find and remove specific share info
            const shareUrl = shareLink.value;
            const shareId = shareUrl.split('/share/')[1];
            if (shareId) {
                localStorage.removeItem(`share_${shareId}`);
            }
            
            // Update UI state
            this.updateShareModalState(false);
            
            Utils.showNotification('공유가 취소되었습니다.');
            
        } catch (error) {
            console.error('Revoke share failed:', error);
            Utils.showNotification('공유 링크 취소에 실패했습니다.', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Show file details
    showFileDetails() {
        if (this.selectedFiles.length !== 1) {
            Utils.showNotification('파일을 하나만 선택해주세요.', 'error');
            return;
        }

        const file = this.selectedFiles[0];
        this.displayFileDetails(file);
    }

    // Display file details
    async displayFileDetails(file) {
        const fileDetailsModal = document.getElementById('fileDetailsModal');
        const fileDetailsThumbnail = document.getElementById('fileDetailsThumbnail');
        const fileDetailsName = document.getElementById('fileDetailsName');
        const fileDetailsSize = document.getElementById('fileDetailsSize');
        const fileDetailsType = document.getElementById('fileDetailsType');
        const fileDetailsOwner = document.getElementById('fileDetailsOwner');
        const fileDetailsCreated = document.getElementById('fileDetailsCreated');
        const fileDetailsModified = document.getElementById('fileDetailsModified');
        const fileDetailsLastViewed = document.getElementById('fileDetailsLastViewed');
        const fileDetailsDescription = document.getElementById('fileDetailsDescription');
        const markImportant = document.getElementById('markImportant');

        if (!fileDetailsModal) return;

        try {
            // Load detailed file info
            const response = await Utils.apiRequest(
                `${CONFIG.API_ENDPOINTS.files.details}/${file.id}`
            );
            
            const fileDetails = response.file;

            // Update modal content
            fileDetailsModal.dataset.fileId = file.id;
            
            // Thumbnail
            const thumbnailHtml = this.generateThumbnailHtml(file);
            if (thumbnailHtml) {
                fileDetailsThumbnail.innerHTML = thumbnailHtml;
            } else {
                fileDetailsThumbnail.innerHTML = `<i class="${this.getFileIcon(file)}"></i>`;
            }

            // File info
            fileDetailsName.textContent = fileDetails.name;
            fileDetailsSize.textContent = Utils.formatFileSize(fileDetails.size);
            fileDetailsType.textContent = fileDetails.mimeType || 'Unknown';
            fileDetailsOwner.textContent = fileDetails.owner || 'Unknown';
            fileDetailsCreated.textContent = Utils.formatDate(fileDetails.created);
            fileDetailsModified.textContent = Utils.formatDate(fileDetails.modified);
            fileDetailsLastViewed.textContent = fileDetails.lastViewed ? 
                Utils.formatDate(fileDetails.lastViewed) : 'Never';
            fileDetailsDescription.value = fileDetails.description || '';

            // Important button
            const isImportant = this.importantFiles.has(file.id);
            markImportant.innerHTML = `
                <i class="fas ${isImportant ? 'fa-star' : 'fa-star-o'}"></i>
                ${isImportant ? '중요 해제' : '중요 표시'}
            `;

            fileDetailsModal.style.display = 'block';
            
        } catch (error) {
            console.error('Failed to load file details:', error);
            Utils.showNotification('파일 정보를 불러오는데 실패했습니다.', 'error');
        }
    }

    // Save file description
    async saveFileDescription() {
        const fileDetailsModal = document.getElementById('fileDetailsModal');
        const fileId = fileDetailsModal.dataset.fileId;
        const description = document.getElementById('fileDetailsDescription').value;

        try {
            await Utils.apiRequest(
                `${CONFIG.API_ENDPOINTS.files.details}/${fileId}`,
                'PUT',
                { description: description }
            );

            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.DESCRIPTION_SAVED);
            
        } catch (error) {
            console.error('Failed to save description:', error);
            Utils.showNotification('설명 저장에 실패했습니다.', 'error');
        }
    }

    // Toggle file important
    toggleFileImportant(fileId) {
        if (this.importantFiles.has(fileId)) {
            this.importantFiles.delete(fileId);
            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.IMPORTANT_UNMARKED);
        } else {
            this.importantFiles.add(fileId);
            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.IMPORTANT_MARKED);
        }
        
        this.saveImportantFiles();
        this.renderFiles();
    }

    // Toggle file important from modal
    toggleFileImportant() {
        const fileDetailsModal = document.getElementById('fileDetailsModal');
        const fileId = fileDetailsModal.dataset.fileId;
        this.toggleFileImportant(fileId);
        
        // Update button
        const markImportant = document.getElementById('markImportant');
        const isImportant = this.importantFiles.has(fileId);
        markImportant.innerHTML = `
            <i class="fas ${isImportant ? 'fa-star' : 'fa-star-o'}"></i>
            ${isImportant ? '중요 해제' : '중요 표시'}
        `;
    }

    // Toggle selected file important
    toggleSelectedFileImportant() {
        if (this.selectedFiles.length === 0) return;

        this.selectedFiles.forEach(file => {
            this.toggleFileImportant(file.id);
        });
    }

    // Rename file
    async renameFile(file, newName) {
        try {
            await Utils.apiRequest(
                CONFIG.API_ENDPOINTS.files.rename,
                'PUT',
                { 
                    fileId: file.id, 
                    newName: newName 
                }
            );

            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.RENAME_SUCCESS);
            await this.loadFiles();
            
        } catch (error) {
            console.error('Rename failed:', error);
            Utils.showNotification(CONFIG.ERROR_MESSAGES.RENAME_FAILED, 'error');
        }
    }

    // Rename selected file
    renameSelectedFile() {
        if (this.selectedFiles.length !== 1) {
            Utils.showNotification('파일을 하나만 선택해주세요.', 'error');
            return;
        }

        const file = this.selectedFiles[0];
        const newName = prompt('새 이름을 입력하세요:', file.name);
        
        if (newName && newName !== file.name) {
            this.renameFile(file, newName);
        }
    }

    // Delete file
    async deleteFile(file) {
        try {
            await Utils.apiRequest(
                CONFIG.API_ENDPOINTS.files.delete,
                'DELETE',
                { fileId: file.id }
            );

            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.DELETE_SUCCESS);
            await this.loadFiles();
            
        } catch (error) {
            console.error('Delete failed:', error);
            Utils.showNotification(CONFIG.ERROR_MESSAGES.DELETE_FAILED, 'error');
        }
    }

    // Delete selected files
    async deleteSelectedFiles() {
        if (this.selectedFiles.length === 0) return;

        const fileNames = this.selectedFiles.map(f => f.name).join(', ');
        const confirmed = confirm(`다음 파일들을 삭제하시겠습니까?\n${fileNames}`);
        
        if (!confirmed) return;

        for (const file of this.selectedFiles) {
            await this.deleteFile(file);
        }
    }

    // Move files
    async moveSelectedFiles() {
        if (this.selectedFiles.length === 0) return;

        const targetPath = prompt('이동할 경로를 입력하세요:', this.currentPath);
        if (!targetPath) return;

        try {
            for (const file of this.selectedFiles) {
                await Utils.apiRequest(
                    CONFIG.API_ENDPOINTS.files.move,
                    'PUT',
                    { 
                        fileId: file.id, 
                        targetPath: targetPath 
                    }
                );
            }

            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.MOVE_SUCCESS);
            await this.loadFiles();
            
        } catch (error) {
            console.error('Move failed:', error);
            Utils.showNotification(CONFIG.ERROR_MESSAGES.MOVE_FAILED, 'error');
        }
    }

    // Create folder
    async createFolder(name) {
        try {
            Utils.showLoading(true);
            
            // Try API first
            try {
                await Utils.apiRequest(
                    CONFIG.API_ENDPOINTS.files.create_folder,
                    'POST',
                    { 
                        name: name,
                        path: this.currentPath
                    }
                );
                
                Utils.showNotification('폴더가 생성되었습니다.');
                
            } catch (apiError) {
                console.warn('API folder creation failed, using local storage:', apiError);
                
                // 🔥 FIXED: 올바른 폴더 경로 처리
                console.log('🔥 FIXED - 폴더 생성 로직');
                console.log('  📁 현재 경로:', this.currentPath);
                console.log('  📂 폴더명:', name);
                
                // Fallback to local storage
                const folderData = {
                    id: Utils.generateId(),
                    name: name,
                    size: 0,
                    type: 'folder',  // 🔥 FIXED: 일관된 타입 사용
                    mimeType: 'application/x-directory',
                    isFolder: true,
                    path: this.currentPath,  // 🔥 FIXED: 폴더가 속한 부모 경로
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    isLocal: true,
                    createdBy: window.authManager?.getCurrentUser()?.email || 'demo-user'
                };
                
                console.log('💾 폴더 데이터 생성 (FIXED):');
                console.log('  📂 폴더명:', folderData.name);
                console.log('  📁 부모 경로:', folderData.path);
                console.log('  🏷️ 타입:', folderData.type);
                console.log('  📂 isFolder:', folderData.isFolder);
                
                // Store folder in local storage
                const storedFiles = JSON.parse(localStorage.getItem('stored_files') || '[]');
                storedFiles.push(folderData);
                localStorage.setItem('stored_files', JSON.stringify(storedFiles));
                
                console.log('✅ 폴더 생성 완료 (FIXED):');
                console.log('  📂 폴더:', folderData.name);
                console.log('  📁 부모 경로:', folderData.path);
                console.log('  📊 총 파일/폴더 수:', storedFiles.length);
                
                // 🔥 FIXED: 생성된 폴더 검증
                console.log('🔍 폴더 생성 검증:');
                const foldersInCurrentPath = this.getStoredFilesForPath(this.currentPath);
                const createdFolder = foldersInCurrentPath.find(f => f.name === name && f.isFolder);
                console.log('  📂 생성된 폴더 확인:', createdFolder ? '✅ 성공' : '❌ 실패');
                
                Utils.showNotification('폴더가 생성되었습니다. (로컬 저장소)');
            }
            
            // Reload files to show the new folder
            await this.loadFiles();
            
        } catch (error) {
            console.error('Create folder failed:', error);
            Utils.showNotification('폴더 생성에 실패했습니다.', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Show create folder dialog
    showCreateFolderDialog() {
        const modal = document.getElementById('createFolderModal');
        const currentPathDisplay = document.getElementById('currentPathDisplay');
        const folderNameInput = document.getElementById('folderName');
        
        if (!modal) return;
        
        // Update current path display
        if (currentPathDisplay) {
            currentPathDisplay.textContent = this.currentPath || '/';
        }
        
        // Clear and focus input
        if (folderNameInput) {
            folderNameInput.value = '';
            folderNameInput.focus();
        }
        
        // Show modal
        modal.style.display = 'block';
    }

    // Trigger file upload
    triggerFileUpload() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.click();
        }
    }

    // Search files
    async searchFiles(term) {
        this.searchTerm = term;
        
        if (term.length > 0) {
            try {
                const response = await Utils.apiRequest(
                    `${CONFIG.API_ENDPOINTS.files.search}?q=${encodeURIComponent(term)}&section=${this.currentSection}`
                );
                
                this.currentFiles = response.files || [];
                this.renderFiles();
                
            } catch (error) {
                console.error('Search failed:', error);
                this.renderFiles(); // Fallback to local filtering
            }
        } else {
            await this.loadFiles();
        }
    }

    // Show AI search modal
    showAISearchModal() {
        const aiSearchModal = document.getElementById('aiSearchModal');
        if (aiSearchModal) {
            aiSearchModal.style.display = 'block';
        }
    }

    // Perform AI search
    async performAISearch() {
        const aiSearchQuery = document.getElementById('aiSearchQuery').value;
        const aiSearchResults = document.getElementById('aiSearchResults');
        
        if (!aiSearchQuery.trim()) {
            Utils.showNotification('검색어를 입력해주세요.', 'error');
            return;
        }

        try {
            Utils.showLoading(true);
            
            const response = await Utils.apiRequest(
                CONFIG.API_ENDPOINTS.files.ai_search,
                'POST',
                { query: aiSearchQuery }
            );

            const results = response.results || [];
            
            aiSearchResults.innerHTML = '';
            
            if (results.length === 0) {
                aiSearchResults.innerHTML = '<p>검색 결과가 없습니다.</p>';
                return;
            }

            results.forEach(file => {
                const resultElement = document.createElement('div');
                resultElement.className = 'ai-search-result';
                resultElement.innerHTML = `
                    <div class="result-icon">
                        <i class="${this.getFileIcon(file)}"></i>
                    </div>
                    <div class="result-info">
                        <div class="result-name">${file.name}</div>
                        <div class="result-meta">
                            <span>${Utils.formatFileSize(file.size)}</span>
                            <span>${Utils.formatDate(file.modified)}</span>
                        </div>
                        <div class="result-reason">${file.matchReason || ''}</div>
                    </div>
                    <div class="result-actions">
                        <button onclick="window.fileManager.openFile(${JSON.stringify(file).replace(/"/g, '&quot;')})">열기</button>
                        <button onclick="window.fileManager.downloadFile(${JSON.stringify(file).replace(/"/g, '&quot;')})">다운로드</button>
                    </div>
                `;
                aiSearchResults.appendChild(resultElement);
            });
            
        } catch (error) {
            console.error('AI search failed:', error);
            Utils.showNotification(CONFIG.ERROR_MESSAGES.AI_SEARCH_FAILED, 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Switch section
    switchSection(section, updateUrl = true) {
        this.currentSection = section;
        this.currentPath = '/';
        
        // Update navigation
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });
        
        // Update URL if requested
        if (updateUrl) {
            this.updateUrl();
        }
        
        // Load files for the new section
        this.loadFiles();
    }

    // Set view mode
    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update view buttons
        const gridViewBtn = document.getElementById('gridViewBtn');
        const listViewBtn = document.getElementById('listViewBtn');
        
        if (gridViewBtn) gridViewBtn.classList.toggle('active', mode === CONFIG.VIEW_MODES.GRID);
        if (listViewBtn) listViewBtn.classList.toggle('active', mode === CONFIG.VIEW_MODES.LIST);
        
        this.updateViewMode();
        this.savePreferences();
    }

    // Update view mode
    updateViewMode() {
        const fileContainer = document.getElementById('fileContainer');
        if (fileContainer) {
            fileContainer.className = `file-container ${this.viewMode}`;
        }
    }

    // Update breadcrumb
    updateBreadcrumb() {
        const breadcrumbNav = document.getElementById('breadcrumbNav');
        if (!breadcrumbNav) return;

        const pathParts = this.currentPath.split('/').filter(part => part);
        const breadcrumbItems = [];

        // Add root
        breadcrumbItems.push(`<a href="#" data-path="/" class="breadcrumb-item">내 파일</a>`);

        // Add path parts
        let currentPath = '';
        pathParts.forEach(part => {
            currentPath += '/' + part;
            breadcrumbItems.push(`<a href="#" data-path="${currentPath}" class="breadcrumb-item">${part}</a>`);
        });

        breadcrumbNav.innerHTML = breadcrumbItems.join(' / ');

        // Add click handlers
        breadcrumbNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const path = link.dataset.path;
                
                console.log('🍞 Breadcrumb clicked, navigating to:', path);
                
                // Navigate to the clicked path with URL update
                this.navigateToFolder(path, true);
            });
        });
    }

    // Update storage UI
    updateStorageUI() {
        if (!this.storageInfo) return;

        const storageUsed = document.getElementById('storageUsed');
        const storageText = document.getElementById('storageText');

        if (storageUsed) {
            const usedPercentage = (this.storageInfo.used / this.storageInfo.total) * 100;
            storageUsed.style.width = `${usedPercentage}%`;
        }

        if (storageText) {
            const usedFormatted = Utils.formatFileSize(this.storageInfo.used);
            const totalFormatted = Utils.formatFileSize(this.storageInfo.total);
            storageText.textContent = `${usedFormatted} / ${totalFormatted} 사용`;
        }
    }

    // Render empty state only when actually empty (not during loading)
    renderEmptyState() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        // Don't show empty state if we're still in initial loading
        if (fileList.innerHTML.includes('initial-loading-state') || 
            fileList.innerHTML.includes('auth-required-state') ||
            fileList.innerHTML.includes('error-state')) {
            console.log('⏭️ Skipping empty state - still in loading/auth/error state');
            return;
        }

        // Double-check authentication before showing empty state
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            console.log('🔒 User not authenticated, showing auth required state');
            this.showNotAuthenticatedState();
            return;
        }

        let message = '파일이 없습니다.';
        let icon = 'fas fa-folder-open';
        let description = '이 폴더는 비어있습니다.';

        switch (this.currentSection) {
            case CONFIG.FILE_SECTIONS.SHARED:
                message = '공유된 파일이 없습니다.';
                icon = 'fas fa-share-alt';
                description = '아직 공유한 파일이 없습니다. 파일을 공유해보세요.';
                break;
            case CONFIG.FILE_SECTIONS.RECENT:
                message = '최근 파일이 없습니다.';
                icon = 'fas fa-clock';
                description = '최근에 접근한 파일이 없습니다.';
                break;
            case CONFIG.FILE_SECTIONS.IMPORTANT:
                message = '중요 파일이 없습니다.';
                icon = 'fas fa-star';
                description = '중요로 표시한 파일이 없습니다.';
                break;
            case CONFIG.FILE_SECTIONS.DELETED:
                message = '삭제된 파일이 없습니다.';
                icon = 'fas fa-trash';
                description = '휴지통이 비어있습니다.';
                break;
            case CONFIG.FILE_SECTIONS.FILES:
            default:
                if (this.currentPath === '/') {
                    message = '파일을 업로드해보세요';
                    description = '첫 번째 파일을 업로드하거나 폴더를 만들어보세요.';
                } else {
                    message = '이 폴더는 비어있습니다';
                    description = `${this.currentPath} 폴더에 파일이 없습니다.`;
                }
                break;
        }

        console.log('📭 Showing empty state for section:', this.currentSection, 'path:', this.currentPath);

        fileList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="empty-text">
                    <h3>${message}</h3>
                    <p>${description}</p>
                </div>
                ${this.currentSection === CONFIG.FILE_SECTIONS.FILES ? `
                    <div class="empty-actions">
                        <button onclick="document.getElementById('fileInput').click()" class="action-btn">
                            <i class="fas fa-upload"></i> 파일 업로드
                        </button>
                        <button onclick="window.fileManager.showCreateFolderDialog()" class="action-btn secondary">
                            <i class="fas fa-folder-plus"></i> 폴더 만들기
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Get current files
    getCurrentFiles() {
        return this.currentFiles;
    }

    // Get selected files
    getSelectedFiles() {
        return this.selectedFiles;
    }

    // Get current path
    getCurrentPath() {
        console.log('🔍 ===== getCurrentPath 호출 디버깅 =====');
        console.log('📁 원본 this.currentPath:', this.currentPath);
        console.log('📋 typeof currentPath:', typeof this.currentPath);
        
        // Ensure we always return a valid path
        let path = this.currentPath || '/';
        console.log('📐 기본값 처리 후:', path);
        
        // Validate and normalize path
        if (typeof path !== 'string') {
            console.log('⚠️ 문자열이 아님, 루트로 변경');
            path = '/';
        }
        
        if (!path.startsWith('/')) {
            console.log('🔧 / 시작 문자 추가');
            path = '/' + path;
        }
        
        // Remove double slashes
        const beforeRemoveDouble = path;
        path = path.replace(/\/+/g, '/');
        if (beforeRemoveDouble !== path) {
            console.log('🔧 중복 슬래시 제거:', beforeRemoveDouble, '->', path);
        }
        
        console.log('✅ 최종 반환 경로:', path);
        console.log('🔍 ===== getCurrentPath 디버깅 끝 =====');
        return path;
    }

    // Get current section
    getCurrentSection() {
        return this.currentSection;
    }

    // Copy share link directly
    async copyShareLinkDirect(shareUrl) {
        try {
            await navigator.clipboard.writeText(shareUrl);
            Utils.showNotification('공유 링크가 클립보드에 복사되었습니다.');
        } catch (error) {
            console.error('Clipboard copy failed:', error);
            Utils.showNotification('클립보드 복사에 실패했습니다.', 'error');
        }
    }

    // Test share link directly
    testShareLinkDirect(shareUrl) {
        if (shareUrl) {
            window.open(shareUrl, '_blank');
        } else {
            Utils.showNotification('공유 링크가 없습니다.', 'error');
        }
    }

    // Revoke share
    async revokeShare(fileId) {
        try {
            const confirmed = confirm('정말로 이 파일의 공유를 취소하시겠습니까?');
            if (!confirmed) return;

            // Remove from file_shares
            const fileShares = localStorage.getItem('file_shares');
            if (fileShares) {
                const shares = JSON.parse(fileShares);
                if (shares[fileId]) {
                    delete shares[fileId];
                    localStorage.setItem('file_shares', JSON.stringify(shares));
                }
            }

            // Remove individual share entries
            const allKeys = Object.keys(localStorage);
            for (const key of allKeys) {
                if (key.startsWith('share_')) {
                    try {
                        const shareInfo = JSON.parse(localStorage.getItem(key));
                        if (shareInfo && shareInfo.fileId === fileId) {
                            localStorage.removeItem(key);
                        }
                    } catch (error) {
                        console.error('Error removing share:', key, error);
                    }
                }
            }

            Utils.showNotification('공유가 취소되었습니다.');
            
            // Refresh shared files list
            if (this.currentSection === CONFIG.FILE_SECTIONS.SHARED) {
                this.loadFiles();
            }
            
        } catch (error) {
            console.error('Error revoking share:', error);
            Utils.showNotification('공유 취소에 실패했습니다.', 'error');
        }
    }

    // Debug function for thumbnail testing
    testThumbnailGeneration() {
        console.log('=== Thumbnail Generation Test ===');
        console.log('Thumbnail config enabled:', CONFIG.APP_CONFIG.THUMBNAIL_CONFIG.enabled);
        console.log('Supported thumbnail types:', CONFIG.APP_CONFIG.THUMBNAIL_CONFIG.supportedTypes);
        
        // Test a few file types
        const testFiles = ['test.jpg', 'test.png', 'test.mp4', 'test.txt'];
        testFiles.forEach(filename => {
            const supported = Utils.isThumbnailSupported(filename);
            console.log(`${filename}: ${supported ? '✓ Supported' : '✗ Not supported'}`);
        });
        
        // Check if all functions exist
        console.log('generateRealThumbnail function exists:', typeof this.generateRealThumbnail === 'function');
        console.log('generateImageThumbnailFromFile function exists:', typeof this.generateImageThumbnailFromFile === 'function');
        console.log('generateVideoThumbnailFromFile function exists:', typeof this.generateVideoThumbnailFromFile === 'function');
        
        console.log('=== End Thumbnail Test ===');
    }

    // 🔥 NEW: 폴더 생성 및 업로드 기능 테스트
    testFolderUploadFeature() {
        console.log('🧪 ===== 폴더 업로드 기능 테스트 시작 =====');
        
        // 현재 상태 확인
        console.log('📁 현재 경로:', this.getCurrentPath());
        console.log('📊 현재 파일 수:', this.getCurrentFiles().length);
        
        // 저장된 파일들 확인
        const allStoredFiles = this.getAllStoredFiles();
        console.log('💾 로컬 저장소 전체 파일 수:', allStoredFiles.length);
        
        // 각 폴더별 파일 확인
        const folderPaths = [...new Set(allStoredFiles.map(f => f.path))];
        console.log('📂 발견된 폴더 경로들:', folderPaths);
        
        folderPaths.forEach(folderPath => {
            const filesInFolder = this.getStoredFilesForPath(folderPath);
            console.log(`📁 "${folderPath}" 폴더의 파일 수: ${filesInFolder.length}`);
            filesInFolder.forEach(file => {
                console.log(`  ${file.isFolder ? '📁' : '📄'} ${file.name}`);
            });
        });
        
        // 업로드 매니저 상태 확인
        if (window.uploadManager) {
            console.log('⬆️ UploadManager 상태: ✅ 정상');
            console.log('⬆️ getCurrentPath 함수:', typeof window.uploadManager.getCurrentPath);
        } else {
            console.log('⬆️ UploadManager 상태: ❌ 없음');
        }
        
        console.log('🧪 ===== 폴더 업로드 기능 테스트 완료 =====');
        
        // 사용자를 위한 권장사항
        console.log('💡 테스트 권장사항:');
        console.log('   1. 새 폴더를 생성해보세요');
        console.log('   2. 생성된 폴더를 더블클릭하여 들어가세요');
        console.log('   3. 해당 폴더에서 파일을 업로드해보세요');
        console.log('   4. 파일이 올바른 폴더에 나타나는지 확인하세요');
    }

    // 🔥 NEW: 로컬 저장소 정리 함수
    clearLocalStorage() {
        const confirmed = confirm('로컬 저장소의 모든 파일과 폴더를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.');
        if (!confirmed) return;
        
        localStorage.removeItem('stored_files');
        localStorage.removeItem('file_shares');
        
        // Clear all share entries
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if (key.startsWith('share_')) {
                localStorage.removeItem(key);
            }
        });
        
        Utils.showNotification('로컬 저장소가 정리되었습니다. 페이지를 새로고침하세요.', 'success');
        console.log('🧹 로컬 저장소 정리 완료');
    }
}

// Initialize file manager when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.fileManager = new FileManager();
});

// Export FileManager
window.FileManager = FileManager;