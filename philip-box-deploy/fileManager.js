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

    // Initialize file manager
    initializeFileManager() {
        this.loadPreferences();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.loadImportantFiles();
        this.loadRecentFiles();
        this.cleanupExpiredShares(); // Clean up expired shares on initialization
        
        // Prevent beforeunload during downloads
        this.setupDownloadProtection();
    }

    // Setup download protection
    setupDownloadProtection() {
        // Remove any existing beforeunload listeners first
        const existingHandlers = window.onbeforeunload;
        window.onbeforeunload = null;
        
        // Set up our own handler
        window.addEventListener('beforeunload', (e) => {
            // NEVER prevent if download is in progress
            if (this.isDownloading) {
                console.log('Download in progress, allowing page navigation');
                return; // Allow navigation without warning
            }
            
            // Only prevent if upload is in progress
            if (window.uploadManager && window.uploadManager.isUploadInProgress()) {
                const message = '업로드가 진행 중입니다. 페이지를 떠나시겠습니까?';
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
            
            // Allow all other navigation
        });
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
        // File Details Modal
        const fileDetailsModal = document.getElementById('fileDetailsModal');
        const fileDetailsModalClose = document.getElementById('fileDetailsModalClose');
        const saveDescription = document.getElementById('saveDescription');
        const markImportant = document.getElementById('markImportant');
        const downloadFromDetails = document.getElementById('downloadFromDetails');

        if (fileDetailsModalClose) {
            fileDetailsModalClose.addEventListener('click', () => {
                fileDetailsModal.style.display = 'none';
            });
        }

        if (saveDescription) {
            saveDescription.addEventListener('click', () => {
                this.saveFileDescription();
            });
        }

        if (markImportant) {
            markImportant.addEventListener('click', () => {
                this.toggleFileImportant();
            });
        }

        if (downloadFromDetails) {
            downloadFromDetails.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const fileId = fileDetailsModal.dataset.fileId;
                const file = this.currentFiles.find(f => f.id === fileId);
                if (file) {
                    await this.downloadFileSecurely(file);
                }
            });
        }

        // Share Modal
        const shareModal = document.getElementById('shareModal');
        const shareModalClose = document.getElementById('shareModalClose');
        const shareExpiry = document.getElementById('shareExpiry');
        const shareExpiryDate = document.getElementById('shareExpiryDate');
        const generateShareLink = document.getElementById('generateShareLink');
        const copyShareLink = document.getElementById('copyShareLink');
        const testShareLink = document.getElementById('testShareLink');
        const revokeShareLink = document.getElementById('revokeShareLink');

        if (shareModalClose) {
            shareModalClose.addEventListener('click', () => {
                shareModal.style.display = 'none';
            });
        }

        if (shareExpiry) {
            shareExpiry.addEventListener('change', () => {
                shareExpiryDate.disabled = !shareExpiry.checked;
            });
        }

        if (generateShareLink) {
            generateShareLink.addEventListener('click', () => {
                this.generateShareLink();
            });
        }

        if (copyShareLink) {
            copyShareLink.addEventListener('click', () => {
                this.copyShareLink();
            });
        }

        if (testShareLink) {
            testShareLink.addEventListener('click', () => {
                this.testShareLink();
            });
        }

        if (revokeShareLink) {
            revokeShareLink.addEventListener('click', () => {
                this.revokeShareLink();
            });
        }

        // AI Search Modal
        const aiSearchModal = document.getElementById('aiSearchModal');
        const aiSearchModalClose = document.getElementById('aiSearchModalClose');
        const aiSearchBtn = document.getElementById('aiSearchBtn');

        if (aiSearchModalClose) {
            aiSearchModalClose.addEventListener('click', () => {
                aiSearchModal.style.display = 'none';
            });
        }

        if (aiSearchBtn) {
            aiSearchBtn.addEventListener('click', () => {
                this.performAISearch();
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

    // Load files
    async loadFiles(path = this.currentPath) {
        try {
            Utils.showLoading(true);

            // Handle different sections
            if (this.currentSection === CONFIG.FILE_SECTIONS.SHARED) {
                // Load shared files from localStorage
                this.cleanupExpiredShares(); // Clean up expired shares first
                this.currentFiles = this.loadSharedFiles();
                this.currentPath = '/'; // Reset path for shared section
                
                this.renderFiles();
                this.updateBreadcrumb();
                return;
            }
            
            if (this.currentSection === CONFIG.FILE_SECTIONS.RECENT) {
                // Load recent files from localStorage
                this.currentFiles = this.recentFiles.slice(0, 50); // Show last 50 recent files
                this.currentPath = '/'; // Reset path for recent section
                
                this.renderFiles();
                this.updateBreadcrumb();
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
                return;
            }
            
            if (this.currentSection === CONFIG.FILE_SECTIONS.DELETED) {
                // Load deleted files from localStorage
                this.currentFiles = JSON.parse(localStorage.getItem('deleted_files') || '[]');
                this.currentPath = '/'; // Reset path for deleted section
                
                this.renderFiles();
                this.updateBreadcrumb();
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
                    console.log('Loaded files from API:', this.currentFiles.length);
                }
            } catch (error) {
                console.warn('API load failed, using local storage:', error);
            }
            
            // Always load and merge local files
            const localFiles = this.getStoredFilesForPath(path);
            console.log('Loading local files for path:', path, 'found:', localFiles.length);
            
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
            
            console.log('Total files loaded:', this.currentFiles.length);
            
            this.renderFiles();
            this.updateBreadcrumb();
            
        } catch (error) {
            console.error('Failed to load files:', error);
            Utils.showNotification('파일을 불러오는데 실패했습니다.', 'error');
            
            // Fallback to local files only
            this.currentFiles = this.getStoredFilesForPath(path);
            this.renderFiles();
            this.updateBreadcrumb();
        } finally {
            Utils.showLoading(false);
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
        
        // Filter files by path
        const filesInPath = allFiles.filter(file => {
            const filePath = (file.path || '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
            return filePath === normalizedPath;
        });
        
        console.log('Files in path', normalizedPath, ':', filesInPath.length);
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
                    <button class="btn-icon" title="다운로드" onclick="event.stopPropagation(); event.preventDefault(); window.fileManager.downloadFileSecurely(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            `;
        } else {
            actionButtons = `
                <div class="file-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); event.preventDefault(); window.fileManager.downloadFileSecurely(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon" onclick="event.stopPropagation(); window.fileManager.showShareModal(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="btn-icon" onclick="event.stopPropagation(); window.fileManager.toggleFileImportant('${file.id}')">
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

    // Generate thumbnail HTML with client-side generation
    generateThumbnailHtml(file) {
        if (!Utils.isThumbnailSupported(file.name)) {
            return null;
        }
        
        const extension = file.name.split('.').pop().toLowerCase();
        const thumbnailId = `thumb-${file.id}`;
        
        // For demo purposes, create thumbnail placeholder
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) {
            // Image thumbnail
            const thumbnailHtml = `
                <div class="file-thumbnail" id="${thumbnailId}">
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
        if (!fileObject || !Utils.isThumbnailSupported(file.name)) {
            return null;
        }
        
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) {
            return await this.generateImageThumbnailFromFile(fileObject);
        } else if (['mp4', 'webm', 'ogg'].includes(extension)) {
            return await this.generateVideoThumbnailFromFile(fileObject);
        }
        
        return null;
    }

    // Generate image thumbnail from actual file
    async generateImageThumbnailFromFile(fileObject) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate thumbnail size (maintain aspect ratio)
                    const maxWidth = 200;
                    const maxHeight = 150;
                    
                    let { width, height } = img;
                    
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    resolve(canvas.toDataURL());
                };
                
                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };
                
                img.src = e.target.result;
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsDataURL(fileObject);
        });
    }

    // Generate video thumbnail from actual file
    async generateVideoThumbnailFromFile(fileObject) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.style.display = 'none';
            document.body.appendChild(video);
            
            video.onloadedmetadata = () => {
                // Seek to 10% of video duration for thumbnail
                video.currentTime = video.duration * 0.1;
            };
            
            video.onseeked = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = 200;
                canvas.height = 150;
                
                ctx.drawImage(video, 0, 0, 200, 150);
                
                document.body.removeChild(video);
                resolve(canvas.toDataURL());
            };
            
            video.onerror = () => {
                document.body.removeChild(video);
                reject(new Error('Failed to load video'));
            };
            
            video.src = URL.createObjectURL(fileObject);
        });
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

    // Handle file double click
    handleFileDoubleClick(file) {
        if (file.type === 'folder') {
            this.navigateToFolder(file.path);
        } else {
            this.openFile(file);
        }
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

    // Navigate to folder
    async navigateToFolder(path) {
        try {
            // Normalize path
            if (!path || typeof path !== 'string') {
                path = '/';
            }
            
            if (!path.startsWith('/')) {
                path = '/' + path;
            }
            
            // Remove double slashes
            path = path.replace(/\/+/g, '/');
            
            console.log('Navigating to folder:', path);
            
            // Update current path before loading files
            this.currentPath = path;
            
            // Load files for the new path
            await this.loadFiles(path);
            
            console.log('Navigation completed, current path is now:', this.currentPath);
            
        } catch (error) {
            console.error('Navigation failed:', error);
            Utils.showNotification('폴더 탐색에 실패했습니다.', 'error');
            
            // Reset to root on error
            this.currentPath = '/';
            await this.loadFiles('/');
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
        try {
            // Prevent any default actions
            if (event) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
            
            // Set download flag immediately
            this.isDownloading = true;
            
            // Use the main download method
            await this.downloadFile(file);
            
        } catch (error) {
            console.error('Secure download failed:', error);
            Utils.showNotification('다운로드에 실패했습니다.', 'error');
        }
    }

    // Download file - 개선된 다운로드 방식
    async downloadFile(file) {
        try {
            console.log('Starting download for:', file.name);
            
            // Set download flag immediately and aggressively
            this.isDownloading = true;
            window.downloadInProgress = true; // Global flag
            
            // Completely disable beforeunload for download
            window.onbeforeunload = null;
            
            // Remove any event listeners temporarily
            const handleBeforeUnload = () => {};
            window.addEventListener('beforeunload', handleBeforeUnload);
            
            Utils.showNotification(`${file.name} 다운로드 준비 중...`, 'info');
            
            // Try download with demo file
            await this.downloadFileDirect(file);
            
            Utils.showNotification(`${file.name} 다운로드 완료`, 'success');
            
        } catch (error) {
            console.error('Download failed:', error);
            Utils.showNotification(`${file.name} 다운로드 실패: ${error.message}`, 'error');
        } finally {
            // Clear download flags after a longer delay
            setTimeout(() => {
                this.isDownloading = false;
                window.downloadInProgress = false;
                console.log('Download flags cleared');
                
                // Restore beforeunload after download is completely done
                this.setupDownloadProtection();
            }, 5000); // 5 second delay to ensure download is started
        }
    }

    // Direct download method (most reliable)
    async downloadFileDirect(file) {
        try {
            let downloadUrl;
            
            // Try API first
            try {
                const response = await Utils.apiRequest(
                    `${CONFIG.API_ENDPOINTS.files.download}/${file.id}`
                );
                downloadUrl = response.downloadUrl || response.url;
            } catch (error) {
                console.warn('API download failed, using demo file:', error);
                
                // Create demo file for download
                const demoContent = this.generateDemoFileContent(file);
                const blob = new Blob([demoContent], { type: file.mimeType || 'text/plain' });
                downloadUrl = URL.createObjectURL(blob);
            }
            
            // Create a temporary download link
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = file.name;
            link.style.display = 'none';
            link.target = '_self'; // Same window to avoid popup blockers
            
            // Add to DOM
            document.body.appendChild(link);
            
            // Disable any navigation warnings during click
            const originalConfirm = window.confirm;
            const originalAlert = window.alert;
            const originalBeforeUnload = window.onbeforeunload;
            
            window.confirm = () => true;
            window.alert = () => {};
            window.onbeforeunload = null;
            
            // Force click without user interaction detection
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
            });
            
            link.dispatchEvent(clickEvent);
            
            // Restore original functions after short delay
            setTimeout(() => {
                window.confirm = originalConfirm;
                window.alert = originalAlert;
                window.onbeforeunload = originalBeforeUnload;
                document.body.removeChild(link);
                
                // Clean up blob URL if it was created
                if (downloadUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(downloadUrl);
                }
            }, 2000);
            
        } catch (error) {
            console.error('Direct download failed:', error);
            // Fallback to iframe method
            await this.downloadViaIframe(file);
        }
    }

    // Generate demo file content for download
    generateDemoFileContent(file) {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        switch (fileExtension) {
            case 'txt':
                return `이것은 ${file.name} 파일의 데모 내용입니다.\n\n파일 정보:\n- 이름: ${file.name}\n- 크기: ${Utils.formatFileSize(file.size)}\n- 생성일: ${new Date().toLocaleDateString()}\n\nPhilip Box 드롭박스 클론에서 생성된 데모 파일입니다.`;
            
            case 'html':
                return `<!DOCTYPE html>
<html>
<head>
    <title>${file.name}</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>${file.name}</h1>
    <p>이것은 Philip Box 드롭박스 클론에서 생성된 데모 HTML 파일입니다.</p>
    <p>파일 크기: ${Utils.formatFileSize(file.size)}</p>
    <p>생성일: ${new Date().toLocaleDateString()}</p>
</body>
</html>`;
            
            case 'json':
                return JSON.stringify({
                    fileName: file.name,
                    fileSize: file.size,
                    createdAt: new Date().toISOString(),
                    source: 'Philip Box Demo',
                    content: 'This is a demo file generated by Philip Box'
                }, null, 2);
            
            case 'csv':
                return `파일명,크기,생성일,소스\n${file.name},${file.size},${new Date().toLocaleDateString()},Philip Box Demo`;
            
            default:
                return `${file.name}\n\n이것은 Philip Box 드롭박스 클론에서 생성된 데모 파일입니다.\n파일 크기: ${Utils.formatFileSize(file.size)}\n생성일: ${new Date().toLocaleDateString()}`;
        }
    }

    // Download via iframe (prevents beforeunload)
    async downloadViaIframe(file) {
        try {
            const response = await Utils.apiRequest(
                `${CONFIG.API_ENDPOINTS.files.download}/${file.id}`
            );
            
            const downloadUrl = response.downloadUrl || response.url;
            
            // Create hidden iframe for download
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.style.visibility = 'hidden';
            iframe.style.position = 'absolute';
            iframe.style.left = '-10000px';
            iframe.style.top = '-10000px';
            
            document.body.appendChild(iframe);
            
            // Set src to trigger download
            iframe.src = downloadUrl;
            
            // Remove iframe after download starts
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 5000);
            
            return true;
            
        } catch (error) {
            console.error('Iframe download failed:', error);
            return false;
        }
    }

    // Download via blob (alternative method)
    async downloadViaBlob(file) {
        try {
            const response = await Utils.apiRequest(
                `${CONFIG.API_ENDPOINTS.files.download}/${file.id}`
            );
            
            const downloadUrl = response.downloadUrl || response.url;
            
            // Fetch file as blob
            const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
            const blobResponse = await fetch(downloadUrl, {
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` })
                }
            });
            
            if (!blobResponse.ok) {
                throw new Error('Download failed');
            }
            
            const blob = await blobResponse.blob();
            
            // Create download link with blob URL
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = file.name;
            link.style.display = 'none';
            
            // Prevent any navigation events
            link.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            document.body.appendChild(link);
            
            // Temporarily disable beforeunload
            const originalBeforeUnload = window.onbeforeunload;
            window.onbeforeunload = null;
            
            // Trigger download
            link.click();
            
            // Restore beforeunload after short delay
            setTimeout(() => {
                window.onbeforeunload = originalBeforeUnload;
                URL.revokeObjectURL(blobUrl);
                document.body.removeChild(link);
            }, 1000);
            
        } catch (error) {
            console.error('Blob download failed:', error);
            throw error;
        }
    }

    // Download selected files safely
    async downloadSelectedFilesSafely() {
        if (this.selectedFiles.length === 0) {
            Utils.showNotification('다운로드할 파일을 선택해주세요.', 'info');
            return;
        }

        try {
            // Set download flag
            this.isDownloading = true;
            
            // Download each selected file
            for (const file of this.selectedFiles) {
                await this.downloadFile(file);
                // Small delay between downloads to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
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
                
                // Validate the share URL - ensure it's not the current page
                if (shareUrl && !shareUrl.includes(window.location.href) && 
                    (shareUrl.includes('/share/') || shareUrl.includes('/file/'))) {
                    // Valid share URL from API
                    console.log('Using API share URL:', shareUrl);
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

    // Generate local share URL with complete file information
    generateLocalShareUrl(file, shareType, permissions, expiry) {
        const shareId = this.generateShareToken();
        const shareUrl = `${window.location.origin}/share.html#${shareId}`;
        
        // Store complete share information
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
            // Store complete file data for sharing
            fileData: {
                id: file.id,
                name: file.name,
                size: file.size,
                type: file.type,
                mimeType: file.mimeType,
                path: file.path || this.getCurrentPath(),
                created: file.created,
                modified: file.modified,
                thumbnail: file.thumbnail
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
        
        console.log('Share created:', shareData);
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
                // Validate the link before copying
                if (shareLink.value.includes(window.location.href) || 
                    shareLink.value === window.location.href) {
                    Utils.showNotification('잘못된 공유 링크입니다. 다시 생성해주세요.', 'error');
                    return;
                }
                
                await navigator.clipboard.writeText(shareLink.value);
                Utils.showNotification('공유 링크가 클립보드에 복사되었습니다.');
                
                // Log for debugging
                console.log('Copied share link:', shareLink.value);
                
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
            Utils.showNotification('공유 링크가 생성되지 않았습니다.', 'error');
            return;
        }
        
        // Extract share ID from URL
        const shareId = shareLink.value.split('#')[1];
        if (!shareId) {
            Utils.showNotification('유효하지 않은 공유 링크입니다.', 'error');
            return;
        }
        
        // Check if share data exists
        const shareData = localStorage.getItem(`share_${shareId}`);
        if (!shareData) {
            Utils.showNotification('공유 데이터를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // Validate share data
        try {
            const parsedData = JSON.parse(shareData);
            if (!parsedData.fileName || !parsedData.fileData) {
                throw new Error('공유 데이터가 불완전합니다.');
            }
            
            // Open share link in new tab
            window.open(shareLink.value, '_blank');
            Utils.showNotification('공유 링크가 새 탭에서 열렸습니다.', 'success');
            
        } catch (error) {
            console.error('Share validation failed:', error);
            Utils.showNotification('공유 링크 검증에 실패했습니다.', 'error');
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
            await Utils.apiRequest(
                CONFIG.API_ENDPOINTS.files.create_folder,
                'POST',
                { 
                    name: name,
                    path: this.currentPath
                }
            );

            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.FOLDER_CREATE_SUCCESS);
            await this.loadFiles();
            
        } catch (error) {
            console.error('Create folder failed:', error);
            Utils.showNotification(CONFIG.ERROR_MESSAGES.FOLDER_CREATE_FAILED, 'error');
        }
    }

    // Show create folder dialog
    showCreateFolderDialog() {
        const folderName = prompt('폴더 이름을 입력하세요:');
        if (folderName) {
            this.createFolder(folderName);
        }
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
    switchSection(section) {
        this.currentSection = section;
        this.currentPath = '/';
        
        // Update navigation
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });
        
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
                this.navigateToFolder(link.dataset.path);
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

    // Render empty state
    renderEmptyState() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        let message = '파일이 없습니다.';
        let icon = 'fas fa-folder-open';

        switch (this.currentSection) {
            case CONFIG.FILE_SECTIONS.SHARED:
                message = '공유된 파일이 없습니다.';
                icon = 'fas fa-share-alt';
                break;
            case CONFIG.FILE_SECTIONS.RECENT:
                message = '최근 파일이 없습니다.';
                icon = 'fas fa-clock';
                break;
            case CONFIG.FILE_SECTIONS.IMPORTANT:
                message = '중요 파일이 없습니다.';
                icon = 'fas fa-star';
                break;
            case CONFIG.FILE_SECTIONS.DELETED:
                message = '삭제된 파일이 없습니다.';
                icon = 'fas fa-trash';
                break;
        }

        fileList.innerHTML = `
            <div class="empty-state">
                <i class="${icon}"></i>
                <p>${message}</p>
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
        // Ensure we always return a valid path
        let path = this.currentPath || '/';
        
        // Validate and normalize path
        if (typeof path !== 'string') {
            path = '/';
        }
        
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Remove double slashes
        path = path.replace(/\/+/g, '/');
        
        console.log('getCurrentPath returning:', path);
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
}

// Initialize file manager when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.fileManager = new FileManager();
});

// Export FileManager
window.FileManager = FileManager; 