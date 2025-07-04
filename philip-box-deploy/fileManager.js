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
        
        this.initializeFileManager();
    }

    // Initialize file manager
    initializeFileManager() {
        this.loadPreferences();
        this.setupEventListeners();
        this.setupDragAndDrop();
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
            }, 300));
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
        const downloadFile = document.getElementById('downloadFile');
        const shareFile = document.getElementById('shareFile');
        const renameFile = document.getElementById('renameFile');
        const moveFile = document.getElementById('moveFile');
        const deleteFile = document.getElementById('deleteFile');

        if (downloadFile) {
            downloadFile.addEventListener('click', () => {
                this.downloadSelectedFiles();
                this.hideContextMenu();
            });
        }

        if (shareFile) {
            shareFile.addEventListener('click', () => {
                this.shareSelectedFiles();
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

    // Load files from server
    async loadFiles(path = this.currentPath) {
        try {
            Utils.showLoading(true);

            const response = await Utils.apiRequest(
                `${CONFIG.API_ENDPOINTS.files.list}?path=${encodeURIComponent(path)}&section=${this.currentSection}`
            );

            this.currentFiles = response.files || [];
            this.currentPath = path;
            
            this.renderFiles();
            this.updateBreadcrumb();
            
        } catch (error) {
            console.error('Failed to load files:', error);
            Utils.showNotification('파일 목록을 불러오는데 실패했습니다.', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Load storage information
    async loadStorageInfo() {
        try {
            const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.storage.usage);
            this.storageInfo = response;
            this.updateStorageUI();
        } catch (error) {
            console.error('Failed to load storage info:', error);
        }
    }

    // Render files in the UI
    renderFiles() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        // Apply filters and sorting
        let filteredFiles = this.currentFiles;
        
        if (this.searchTerm) {
            filteredFiles = Utils.filterFiles(filteredFiles, this.searchTerm);
        }
        
        filteredFiles = Utils.sortFiles(filteredFiles, this.sortBy, this.sortOrder);

        // Clear existing files
        fileList.innerHTML = '';

        // Add view mode class
        fileList.className = `file-list ${this.viewMode}-view`;

        if (filteredFiles.length === 0) {
            this.renderEmptyState();
            return;
        }

        // Render files
        filteredFiles.forEach(file => {
            const fileElement = this.createFileElement(file);
            fileList.appendChild(fileElement);
        });
    }

    // Create file element
    createFileElement(file) {
        const fileItem = document.createElement('div');
        fileItem.className = `file-item ${this.viewMode}-view`;
        fileItem.dataset.fileId = file.id;
        fileItem.dataset.fileName = file.name;
        fileItem.dataset.fileType = file.type;
        fileItem.dataset.isFolder = file.isFolder;

        const icon = Utils.getFileTypeIcon(file.name, file.isFolder);
        const iconClass = `file-icon ${Utils.getFileExtension(file.name)}`;

        fileItem.innerHTML = `
            <i class="${icon} ${iconClass}"></i>
            <div class="file-info">
                <div class="file-name">${Utils.escapeHtml(file.name)}</div>
                <div class="file-meta">
                    <span class="file-size">${file.isFolder ? '폴더' : Utils.formatFileSize(file.size)}</span>
                    <span class="file-date">${Utils.formatDate(file.modifiedAt)}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="file-action" title="다운로드">
                    <i class="fas fa-download"></i>
                </button>
                <button class="file-action" title="공유">
                    <i class="fas fa-share-alt"></i>
                </button>
                <button class="file-action" title="더보기">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        `;

        // Add event listeners
        fileItem.addEventListener('click', (e) => {
            if (e.target.closest('.file-action')) {
                return; // Don't handle file click if action button was clicked
            }
            this.handleFileClick(file, e);
        });

        fileItem.addEventListener('dblclick', () => {
            this.handleFileDoubleClick(file);
        });

        fileItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, file);
        });

        // Action buttons
        const downloadBtn = fileItem.querySelector('.file-action[title="다운로드"]');
        const shareBtn = fileItem.querySelector('.file-action[title="공유"]');
        const moreBtn = fileItem.querySelector('.file-action[title="더보기"]');

        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.downloadFile(file);
            });
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.shareFile(file);
            });
        }

        if (moreBtn) {
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showContextMenu(e, file);
            });
        }

        return fileItem;
    }

    // Handle file click
    handleFileClick(file, event) {
        if (event.ctrlKey || event.metaKey) {
            // Multi-select
            this.toggleFileSelection(file);
        } else {
            // Single select
            this.selectFile(file);
        }
    }

    // Handle file double click
    handleFileDoubleClick(file) {
        if (file.isFolder) {
            this.navigateToFolder(file.path);
        } else {
            this.previewFile(file);
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
        if (index !== -1) {
            this.selectedFiles.splice(index, 1);
        } else {
            this.selectedFiles.push(file);
        }
        this.updateFileSelection();
    }

    // Update file selection UI
    updateFileSelection() {
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach(item => {
            const fileId = item.dataset.fileId;
            const isSelected = this.selectedFiles.some(f => f.id === fileId);
            item.classList.toggle('selected', isSelected);
        });
    }

    // Navigate to folder
    async navigateToFolder(path) {
        await this.loadFiles(path);
    }

    // Preview file
    previewFile(file) {
        Utils.addToRecentFiles(file);
        window.previewManager.showPreview(file);
    }

    // Show context menu
    showContextMenu(event, file) {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;

        // Select the file if not already selected
        if (!this.selectedFiles.some(f => f.id === file.id)) {
            this.selectFile(file);
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

    // Download file
    async downloadFile(file) {
        try {
            const response = await Utils.apiRequest(
                `${CONFIG.API_ENDPOINTS.files.download}/${file.id}`
            );
            
            Utils.downloadFile(response.downloadUrl, file.name);
            Utils.showNotification(`${file.name} 다운로드 시작`);
            
        } catch (error) {
            console.error('Download failed:', error);
            Utils.showNotification(CONFIG.ERROR_MESSAGES.DOWNLOAD_FAILED, 'error');
        }
    }

    // Download selected files
    async downloadSelectedFiles() {
        if (this.selectedFiles.length === 0) return;

        for (const file of this.selectedFiles) {
            await this.downloadFile(file);
        }
    }

    // Share file
    async shareFile(file) {
        try {
            const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.files.share, {
                method: 'POST',
                body: JSON.stringify({ fileId: file.id })
            });

            const shareUrl = response.shareUrl;
            await Utils.copyToClipboard(shareUrl);
            Utils.showNotification('공유 링크가 클립보드에 복사되었습니다.');
            
        } catch (error) {
            console.error('Share failed:', error);
            Utils.showNotification(CONFIG.ERROR_MESSAGES.SHARE_FAILED, 'error');
        }
    }

    // Share selected files
    async shareSelectedFiles() {
        if (this.selectedFiles.length === 0) return;

        for (const file of this.selectedFiles) {
            await this.shareFile(file);
        }
    }

    // Rename file
    async renameFile(file, newName) {
        try {
            await Utils.apiRequest(CONFIG.API_ENDPOINTS.files.rename, {
                method: 'PUT',
                body: JSON.stringify({ 
                    fileId: file.id, 
                    newName: newName 
                })
            });

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
            await Utils.apiRequest(CONFIG.API_ENDPOINTS.files.delete, {
                method: 'DELETE',
                body: JSON.stringify({ fileId: file.id })
            });

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
                await Utils.apiRequest(CONFIG.API_ENDPOINTS.files.move, {
                    method: 'PUT',
                    body: JSON.stringify({ 
                        fileId: file.id, 
                        targetPath: targetPath 
                    })
                });
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
            await Utils.apiRequest(CONFIG.API_ENDPOINTS.files.create_folder, {
                method: 'POST',
                body: JSON.stringify({ 
                    name: name,
                    path: this.currentPath
                })
            });

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
    searchFiles(term) {
        this.searchTerm = term;
        this.renderFiles();
    }

    // Switch section
    switchSection(section) {
        this.currentSection = section;
        
        // Update navigation UI
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        // Load files for new section
        this.loadFiles('/');
    }

    // Set view mode
    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update view buttons
        const gridBtn = document.getElementById('gridViewBtn');
        const listBtn = document.getElementById('listViewBtn');
        
        if (gridBtn) gridBtn.classList.toggle('active', mode === CONFIG.VIEW_MODES.GRID);
        if (listBtn) listBtn.classList.toggle('active', mode === CONFIG.VIEW_MODES.LIST);
        
        // Re-render files
        this.renderFiles();
        this.savePreferences();
    }

    // Update view mode UI
    updateViewMode() {
        this.setViewMode(this.viewMode);
    }

    // Update breadcrumb
    updateBreadcrumb() {
        const breadcrumbNav = document.getElementById('breadcrumbNav');
        if (!breadcrumbNav) return;

        const breadcrumb = Utils.getBreadcrumbPath(this.currentPath);
        breadcrumbNav.innerHTML = '';

        breadcrumb.forEach((crumb, index) => {
            const crumbElement = document.createElement('a');
            crumbElement.href = '#';
            crumbElement.className = 'breadcrumb-item';
            crumbElement.textContent = crumb.name;
            crumbElement.dataset.path = crumb.path;
            
            if (index === breadcrumb.length - 1) {
                crumbElement.classList.add('active');
            }

            crumbElement.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToFolder(crumb.path);
            });

            breadcrumbNav.appendChild(crumbElement);
        });
    }

    // Update storage UI
    updateStorageUI() {
        if (!this.storageInfo) return;

        const storageUsed = document.getElementById('storageUsed');
        const storageText = document.getElementById('storageText');

        if (storageUsed) {
            const percentage = Utils.getStorageUsagePercentage(
                this.storageInfo.used, 
                this.storageInfo.total
            );
            storageUsed.style.width = percentage + '%';
        }

        if (storageText) {
            storageText.textContent = Utils.formatStorageUsage(
                this.storageInfo.used,
                this.storageInfo.total
            );
        }
    }

    // Render empty state
    renderEmptyState() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <i class="fas fa-folder-open"></i>
            <h3>폴더가 비어있습니다</h3>
            <p>파일을 업로드하거나 새 폴더를 만들어보세요.</p>
        `;

        fileList.appendChild(emptyState);
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
        return this.currentPath;
    }
}

// Initialize file manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.fileManager = new FileManager();
});

// Export FileManager
window.FileManager = FileManager; 