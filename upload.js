// Upload Manager
class UploadManager {
    constructor() {
        this.currentUploads = [];
        this.uploadQueue = [];
        this.maxConcurrentUploads = 3;
        this.isUploading = false;
        this.uploadAreaVisible = false;

        this.initializeUploadManager();
    }

    // Initialize upload manager
    initializeUploadManager() {
        this.setupFileInput();
        this.setupUploadArea();
        this.setupUploadEvents();
    }

    // Setup file input
    setupFileInput() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            // Remove any existing event listeners first
            fileInput.removeEventListener('change', this.fileInputHandler);

            // Create bound handler to preserve 'this' context
            this.fileInputHandler = (e) => {
                const files = Array.from(e.target.files);
                console.log('File input changed, files:', files.length);

                if (files.length > 0) {
                    this.handleFileUpload(files);
                }

                // Don't reset here to avoid conflicts
                // Reset will be handled in completeAllUploads
            };

            // Add event listener
            fileInput.addEventListener('change', this.fileInputHandler);

            console.log('File input event listener setup complete');
        }
    }

    // Reset file input completely
    resetFileInput() {
        console.log('Resetting file input...');

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            // Clear the value
            fileInput.value = '';

            // Create a new file input to completely reset it
            const newFileInput = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);

            // Re-setup event listeners for the new input
            this.setupFileInput();

            console.log('File input reset complete');
        }
    }

    // Setup upload area
    setupUploadArea() {
        const uploadZone = document.getElementById('uploadZone');
        if (uploadZone) {
            uploadZone.addEventListener('click', () => {
                this.triggerFileSelection();
            });
        }
    }

    // Setup upload events
    setupUploadEvents() {
        // Close upload area when clicking outside
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.addEventListener('click', (e) => {
                if (e.target === uploadArea) {
                    this.hideUploadArea();
                }
            });
        }

        // ESC key to close upload area
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.uploadAreaVisible) {
                this.hideUploadArea();
            }
        });
    }

    // Trigger file selection
    triggerFileSelection() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.click();
        }
    }

    // Handle file upload
    async handleFileUpload(files) {
        // Validate files
        const validFiles = [];
        const invalidFiles = [];

        for (const file of files) {
            const errors = Utils.validateFile(file);
            if (errors.length === 0) {
                validFiles.push(file);
            } else {
                invalidFiles.push({ file, errors });
            }
        }

        // Show validation errors
        if (invalidFiles.length > 0) {
            const errorMessages = invalidFiles.map(item =>
                `${item.file.name}: ${item.errors.join(', ')}`
            ).join('\n');

            Utils.showNotification(
                `다음 파일들은 업로드할 수 없습니다:\n${errorMessages}`,
                'error'
            );
        }

        // Start upload for valid files
        if (validFiles.length > 0) {
            this.startUpload(validFiles);
        }
    }

    // Start upload process
    async startUpload(files) {
        // Clear previous uploads if any
        this.currentUploads = [];
        this.uploadQueue = [];

        // Add files to upload queue
        const uploadTasks = files.map(file => this.createUploadTask(file));
        this.uploadQueue.push(...uploadTasks);

        // Show upload area
        this.showUploadArea();

        // Start processing queue
        this.processUploadQueue();
    }

    // Create upload task
    createUploadTask(file) {
        return {
            id: Utils.generateId(),
            file: file,
            progress: 0,
            status: 'pending', // pending, uploading, completed, failed
            startTime: null,
            endTime: null,
            uploadedBytes: 0,
            totalBytes: file.size,
            chunkIndex: 0,
            totalChunks: Math.ceil(file.size / CONFIG.APP_CONFIG.CHUNK_SIZE),
            error: null
        };
    }

    // Process upload queue
    async processUploadQueue() {
        if (this.isUploading || this.uploadQueue.length === 0) return;

        this.isUploading = true;

        while (this.uploadQueue.length > 0 && this.currentUploads.length < this.maxConcurrentUploads) {
            const task = this.uploadQueue.shift();
            this.currentUploads.push(task);
            this.uploadFile(task);
        }

        // Check if we're done
        if (this.currentUploads.length === 0) {
            this.completeAllUploads();
        }
    }

    // Complete all uploads and clean up
    async completeAllUploads() {
            console.log('Completing all uploads and cleaning up...');

            // Update overall progress to 100%
            const overallProgressBar = document.getElementById('progressFill');
            if (overallProgressBar) {
                overallProgressBar.style.width = '100%';
            }

            const overallProgressText = document.getElementById('progressText');
            if (overallProgressText) {
                overallProgressText.textContent = '업로드 완료!';
            }

            // Show completion message
            const completedCount = this.currentUploads.filter(t => t.status === 'completed').length;
            const failedCount = this.currentUploads.filter(t => t.status === 'failed').length;

            if (completedCount > 0) {
                Utils.showNotification(
                        `${completedCount}개 파일 업로드 완료${failedCount > 0 ? `, ${failedCount}개 실패` : ''}`,
                failedCount > 0 ? 'warning' : 'success'
            );
        }
        
        // Wait a moment for user to see completion
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Hide upload area immediately and completely
        this.hideUploadArea();
        
        // Reset all upload states completely
        this.resetUploadState();
        
        // Refresh file list to show new files
        if (window.fileManager) {
            await window.fileManager.loadFiles();
            await window.fileManager.loadStorageInfo();
        }
        
        // Trigger upload completed event
        if (window.eventBus) {
            window.eventBus.dispatchEvent(new CustomEvent('files-uploaded', {
                detail: { count: completedCount }
            }));
        }
        
        console.log('All uploads completed and state completely reset');
    }

    // Reset upload state completely
    resetUploadState() {
        console.log('Resetting upload state completely...');
        
        // Clear all upload data
        this.currentUploads = [];
        this.uploadQueue = [];
        this.uploadAreaVisible = false;
        
        // Reset file input completely
        this.resetFileInput();
        
        // Clear upload area content
        const uploadProgress = document.getElementById('uploadProgress');
        if (uploadProgress) {
            uploadProgress.innerHTML = '';
            uploadProgress.style.display = 'none';
        }
        
        // Reset progress elements
        const overallProgressBar = document.getElementById('progressFill');
        if (overallProgressBar) {
            overallProgressBar.style.width = '0%';
        }
        
        const overallProgressText = document.getElementById('progressText');
        if (overallProgressText) {
            overallProgressText.textContent = '';
        }
        
        console.log('Upload state reset complete');
    }

    // Upload single file
    async uploadFile(task) {
        try {
            task.status = 'uploading';
            task.startTime = Date.now();
            
            this.updateUploadProgress(task);

            // Temporarily use simple upload for all files until backend supports chunked upload
            // if (task.file.size > CONFIG.APP_CONFIG.CHUNK_SIZE) {
            //     await this.uploadFileChunked(task);
            // } else {
                await this.uploadFileSimple(task);
            // }

            task.status = 'completed';
            task.endTime = Date.now();
            task.progress = 100;
            
            this.updateUploadProgress(task);
            this.removeFromCurrentUploads(task);
            
        } catch (error) {
            console.error('Upload failed:', error);
            task.status = 'failed';
            task.error = error.message;
            
            this.updateUploadProgress(task);
            this.removeFromCurrentUploads(task);
            
            Utils.showNotification(
                `${task.file.name} 업로드 실패: ${error.message}`,
                'error'
            );
        }
    }

    // Upload file (simplified version)
    async uploadFileSimple(task) {
        try {
            console.log('🔥 FIREBASE STYLE - 파일 업로드 시작');
            
            const file = task.file;
            
            // 🔥 현재 폴더 가져오기 (FileManager에서)
            let currentFolder = '/';
            if (window.fileManager && typeof window.fileManager.getCurrentPath === 'function') {
                currentFolder = window.fileManager.getCurrentPath();
                console.log('📁 FileManager에서 현재 폴더 획득:', currentFolder);
            } else {
                console.warn('⚠️ FileManager 없음, 루트 폴더 사용');
            }
            
            // 🔥 경로 정규화
            if (!currentFolder || currentFolder === '') {
                currentFolder = '/';
            }
            
            console.log('📁 업로드 대상 폴더:', currentFolder);
            console.log('📄 업로드 파일명:', file.name);
            console.log('📊 파일 크기:', Utils.formatFileSize(file.size));
            
            // Try API upload first
            const response = await Utils.apiRequest(
                CONFIG.API_ENDPOINTS.files.upload,
                'POST',
                {
                    file: file,
                    path: currentFolder  // 🔥 현재 폴더 경로 사용
                },
                true // isFormData
            );
            
            console.log('✅ API 업로드 성공:', response);
            
            // 🔥 업로드 성공 후 파일매니저 새로고침
            this.refreshFileManagerAfterUpload(currentFolder);
            
            return response;
            
        } catch (error) {
            console.warn('⚠️ API 업로드 실패, 로컬 저장소 사용:', error);
            
            // 🔥 현재 폴더 다시 가져오기 (에러 후에도)
            let currentFolder = '/';
            if (window.fileManager && typeof window.fileManager.getCurrentPath === 'function') {
                currentFolder = window.fileManager.getCurrentPath();
            }
            
            // Fallback to local storage
            const result = await this.uploadFileLocal(file, currentFolder, task);
            
            // 🔥 로컬 업로드 성공 후에도 파일매니저 새로고침
            this.refreshFileManagerAfterUpload(currentFolder);
            
            return result;
        }
    }

    // Upload file to local storage (fallback)
    async uploadFileLocal(file, targetFolder, task) {
        return new Promise(async (resolve, reject) => {
            try {
                // Simulate upload progress
                for (let i = 0; i <= 100; i += 10) {
                    task.progress = i;
                    task.uploadedBytes = (file.size * i) / 100;
                    this.updateUploadProgress(task);
                    
                    // Small delay to simulate upload
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                console.log('🔥 FIREBASE STYLE - 로컬 저장소 업로드');
                console.log('  📁 대상 폴더:', targetFolder);
                console.log('  📄 파일명:', file.name);
                
                // 🔥 FIXED: 올바른 경로 처리
                // targetFolder는 파일이 속할 폴더의 경로입니다
                // 파일의 path는 부모 폴더 경로로 설정해야 합니다
                const fileData = {
                    id: Utils.generateId(),
                    name: file.name,
                    size: file.size,
                    type: file.type === 'application/x-msdos-program' ? 'file' : (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file'),
                    mimeType: file.type || 'application/octet-stream',
                    path: targetFolder,  // 🔥 FIXED: 파일이 속한 폴더의 경로
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    isLocal: true,
                    uploadedBy: window.authManager?.getCurrentUser()?.email || 'demo-user',
                    // 🔥 NEW: Generate unique file URL for local files
                    fileUrl: `${window.location.origin}/file/${Utils.generateId()}`,
                    downloadUrl: null  // Local files don't have external download URLs
                };
                
                console.log('💾 파일 데이터 생성 (FIXED):');
                console.log('  📄 이름:', fileData.name);
                console.log('  📁 부모 폴더 경로:', fileData.path);
                console.log('  📊 크기:', fileData.size);
                console.log('  🔗 URL:', fileData.fileUrl);
                
                // 🔥 Firebase 스타일: 이미지 썸네일 생성
                await this.generateFirebaseStyleThumbnail(fileData, file);
                
                // 🔥 Firebase 스타일: 저장소에 파일 저장
                const storedFiles = JSON.parse(localStorage.getItem('stored_files') || '[]');
                storedFiles.push(fileData);
                localStorage.setItem('stored_files', JSON.stringify(storedFiles));
                
                console.log('✅ FIREBASE STYLE 로컬 저장 성공 (FIXED):');
                console.log('  📄 파일:', fileData.name);
                console.log('  📁 저장된 폴더 경로:', fileData.path);
                console.log('  🔗 URL:', fileData.fileUrl);
                console.log('  📊 총 파일 수:', storedFiles.length);
                
                // 🔥 FIXED: 저장된 파일 검증
                console.log('🔍 저장 검증:');
                const verifyFiles = this.verifyFileStorage(targetFolder);
                console.log('  📂 폴더에서 찾은 파일 수:', verifyFiles.length);
                
                // Success notification with URL info
                const folderDisplay = targetFolder === '/' ? '루트' : targetFolder;
                Utils.showNotification(`📁 ${file.name}이(가) ${folderDisplay} 폴더에 업로드되었습니다. 고유 URL이 생성되었습니다.`, 'success');
                
                resolve({
                    success: true,
                    file: fileData,
                    message: `File uploaded to ${targetFolder} successfully (local storage)`,
                    fileUrl: fileData.fileUrl  // 🔥 Include file URL in response
                });
                
            } catch (error) {
                console.error('❌ 로컬 업로드 실패:', error);
                reject(error);
            }
        });
    }

    // 🔥 NEW: 파일 저장 검증 함수
    verifyFileStorage(folderPath) {
        const storedFiles = JSON.parse(localStorage.getItem('stored_files') || '[]');
        const filesInFolder = storedFiles.filter(file => {
            const normalizedFilePath = (file.path || '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
            const normalizedFolderPath = folderPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
            return normalizedFilePath === normalizedFolderPath;
        });
        
        console.log('🔍 저장 검증 결과:');
        console.log('  📁 대상 폴더:', folderPath);
        console.log('  📄 폴더의 파일들:', filesInFolder.map(f => f.name));
        
        return filesInFolder;
    }

    // 🔥 Firebase 스타일: 자동 썸네일 생성 (onFinalize 트리거와 유사)
    async generateFirebaseStyleThumbnail(fileData, fileObject) {
        const contentType = fileObject.type || 'application/octet-stream';
        const fileName = fileData.name;
        const filePath = fileData.path === '/' ? `/${fileName}` : `${fileData.path}/${fileName}`;
        
        console.log('🔥 FIREBASE STYLE - Auto thumbnail generation triggered');
        console.log('  📄 File:', fileName);
        console.log('  📁 Path:', filePath);
        console.log('  📋 Content Type:', contentType);
        
        // 🔥 Firebase 스타일: 이미지가 아니면 종료
        if (!contentType.startsWith('image/')) {
            console.log('❌ 이미지 파일이 아님:', contentType);
            return;
        }
        
        // 🔥 Firebase 스타일: 썸네일 중복 방지
        if (fileName.includes('_thumb')) {
            console.log('❌ 이미 썸네일임:', fileName);
            return;
        }
        
        try {
            console.log('🖼️ Firebase 스타일 썸네일 생성 시작:', fileName);
            
            // 📌 Firebase 스타일: 썸네일 파일명 생성
            const thumbFileName = fileName.replace(/\.(jpg|jpeg|png|gif|webp|bmp)$/i, '_thumb.jpg');
            console.log('  📸 Thumbnail name:', thumbFileName);
            
            // 🔥 실제 썸네일 생성
            if (window.fileManager && typeof window.fileManager.generateRealThumbnail === 'function') {
                const thumbnailData = await window.fileManager.generateRealThumbnail(fileData, fileObject);
                if (thumbnailData) {
                    fileData.thumbnail = thumbnailData;
                    fileData.thumbnailName = thumbFileName;
                    console.log('✅ Firebase 스타일 썸네일 생성 완료:', thumbFileName);
                } else {
                    console.log('⚠️ 썸네일 데이터 없음:', fileName);
                }
            } else {
                console.warn('⚠️ FileManager 또는 generateRealThumbnail 메서드 없음');
            }
            
        } catch (error) {
            console.error('❌ Firebase 스타일 썸네일 생성 실패:', error);
            // Firebase 스타일: 썸네일 생성 실패해도 원본 파일 업로드는 계속
        }
    }

    // Update upload progress
    updateUploadProgress(task) {
        // Update individual task progress
        const progressBar = document.getElementById(`progress-${task.id}`);
        if (progressBar) {
            progressBar.style.width = `${task.progress}%`;
        }
        
        const progressText = document.getElementById(`progress-text-${task.id}`);
        if (progressText) {
            progressText.textContent = `${Math.round(task.progress)}% - ${this.getStatusText(task)}`;
        }
        
        // Update overall progress
        this.updateOverallProgress();
    }

    // Get status text
    getStatusText(task) {
        switch (task.status) {
            case 'pending':
                return '대기 중...';
            case 'uploading':
                const speed = this.calculateUploadSpeed(task);
                const eta = this.calculateETA(task);
                return `업로드 중... ${speed ? `${speed}/초` : ''} ${eta ? `(${eta} 남음)` : ''}`;
            case 'completed':
                return '완료됨';
            case 'failed':
                return `실패: ${task.error || '알 수 없는 오류'}`;
            default:
                return '';
        }
    }

    // Calculate upload speed
    calculateUploadSpeed(task) {
        if (!task.startTime || task.uploadedBytes === 0) return null;
        
        const elapsedTime = (Date.now() - task.startTime) / 1000;
        const speed = task.uploadedBytes / elapsedTime;
        
        return Utils.formatFileSize(speed);
    }

    // Calculate ETA
    calculateETA(task) {
        if (!task.startTime || task.uploadedBytes === 0 || task.progress >= 100) return null;
        
        const elapsedTime = (Date.now() - task.startTime) / 1000;
        const remainingBytes = task.totalBytes - task.uploadedBytes;
        const speed = task.uploadedBytes / elapsedTime;
        
        if (speed > 0) {
            const eta = remainingBytes / speed;
            return Utils.formatTime(eta);
        }
        
        return null;
    }

    // Update overall progress
    updateOverallProgress() {
        const allTasks = [...this.currentUploads, ...this.uploadQueue];
        if (allTasks.length === 0) return;
        
        const totalProgress = allTasks.reduce((sum, task) => sum + task.progress, 0);
        const overallProgress = totalProgress / allTasks.length;
        
        const overallProgressBar = document.getElementById('progressFill');
        if (overallProgressBar) {
            overallProgressBar.style.width = `${overallProgress}%`;
        }
        
        const overallProgressText = document.getElementById('progressText');
        if (overallProgressText) {
            const completedCount = allTasks.filter(task => task.status === 'completed').length;
            overallProgressText.textContent = `업로드 중... ${completedCount}/${allTasks.length} 완료`;
        }
    }

    // Remove from current uploads
    removeFromCurrentUploads(task) {
        const index = this.currentUploads.findIndex(t => t.id === task.id);
        if (index > -1) {
            this.currentUploads.splice(index, 1);
        }
        
        // Continue processing queue
        this.processUploadQueue();
    }

    // Show upload area
    showUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.style.display = 'flex';
            this.uploadAreaVisible = true;
        }
        
        // Create progress elements for each task
        const progressContainer = document.getElementById('uploadProgress');
        if (progressContainer) {
            progressContainer.innerHTML = '';
            
            const allTasks = [...this.currentUploads, ...this.uploadQueue];
            allTasks.forEach(task => {
                const taskElement = document.createElement('div');
                taskElement.className = 'upload-task';
                taskElement.innerHTML = `
                    <div class="task-info">
                        <span class="task-name">${task.file.name}</span>
                        <span class="task-size">${Utils.formatFileSize(task.file.size)}</span>
                    </div>
                    <div class="task-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress-${task.id}" style="width: 0%"></div>
                        </div>
                        <span class="progress-text" id="progress-text-${task.id}">0% - 대기 중...</span>
                    </div>
                `;
                progressContainer.appendChild(taskElement);
            });
        }
    }

    // Hide upload area
    hideUploadArea() {
        console.log('Hiding upload area completely...');
        
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.style.display = 'none';
            uploadArea.classList.remove('active');
        }

        const uploadZone = document.getElementById('uploadZone');
        if (uploadZone) {
            uploadZone.style.display = 'block';
        }

        const uploadProgress = document.getElementById('uploadProgress');
        if (uploadProgress) {
            uploadProgress.style.display = 'none';
            uploadProgress.classList.remove('active');
        }

        this.uploadAreaVisible = false;
        this.isUploading = false;
        
        console.log('Upload area hidden completely');
    }

    // Cancel upload
    cancelUpload(taskId) {
        const task = this.currentUploads.find(t => t.id === taskId);
        if (task) {
            task.status = 'cancelled';
            this.removeFromCurrentUploads(task);
        }
    }

    // Cancel all uploads
    cancelAllUploads() {
        this.currentUploads.forEach(task => {
            task.status = 'cancelled';
        });
        this.currentUploads = [];
        this.uploadQueue = [];
        this.isUploading = false;
        this.hideUploadArea();
    }

    // Get upload stats
    getUploadStats() {
        return {
            totalUploads: this.currentUploads.length + this.uploadQueue.length,
            activeUploads: this.currentUploads.length,
            queuedUploads: this.uploadQueue.length,
            completedUploads: this.currentUploads.filter(t => t.status === 'completed').length,
            failedUploads: this.currentUploads.filter(t => t.status === 'failed').length
        };
    }

    // Check if upload is in progress
    isUploadInProgress() {
        return this.isUploading || this.currentUploads.length > 0;
    }

    // Handle paste event for file uploads
    handlePaste(event) {
        const items = event.clipboardData.items;
        const files = [];
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    files.push(file);
                }
            }
        }
        
        if (files.length > 0) {
            this.handleFileUpload(files);
        }
    }

    // Handle URL upload
    async handleUrlUpload(url) {
        try {
            const response = await Utils.apiRequest(
                CONFIG.API_ENDPOINTS.files.upload,
                'POST',
                { url: url, path: window.fileManager ? window.fileManager.getCurrentPath() : '/' }
            );
            
            Utils.showNotification('URL에서 파일을 업로드했습니다.');
            
            // Refresh file list
            if (window.fileManager) {
                await window.fileManager.loadFiles();
                await window.fileManager.loadStorageInfo();
            }
            
        } catch (error) {
            console.error('URL upload failed:', error);
            Utils.showNotification('URL 업로드에 실패했습니다.', 'error');
        }
    }

    // Pause upload
    pauseUpload(taskId) {
        const task = this.currentUploads.find(t => t.id === taskId);
        if (task) {
            task.status = 'paused';
        }
    }

    // Resume upload
    resumeUpload(taskId) {
        const task = this.currentUploads.find(t => t.id === taskId);
        if (task && task.status === 'paused') {
            task.status = 'uploading';
            this.uploadFile(task);
        }
    }

    // Retry upload
    retryUpload(taskId) {
        const task = this.currentUploads.find(t => t.id === taskId);
        if (task && task.status === 'failed') {
            task.status = 'pending';
            task.progress = 0;
            task.uploadedBytes = 0;
            task.error = null;
            
            this.uploadFile(task);
        }
    }

    // Get current uploads
    getCurrentUploads() {
        return this.currentUploads;
    }

    // Get upload queue
    getUploadQueue() {
        return this.uploadQueue;
    }

    // Upload file with chunking (for large files)
    async uploadFileChunked(task) {
        const { file } = task;
        const chunks = Math.ceil(file.size / CONFIG.APP_CONFIG.CHUNK_SIZE);
        
        // Initialize chunked upload
        const uploadId = await this.initializeChunkedUpload(task);
        
        // Upload chunks
        for (let i = 0; i < chunks; i++) {
            const start = i * CONFIG.APP_CONFIG.CHUNK_SIZE;
            const end = Math.min(start + CONFIG.APP_CONFIG.CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            
            await this.uploadChunk(task, uploadId, i, chunk);
            
            task.chunkIndex = i + 1;
            task.progress = (task.chunkIndex / chunks) * 100;
            task.uploadedBytes = end;
            
            this.updateUploadProgress(task);
        }
        
        // Complete chunked upload
        await this.completeChunkedUpload(task, uploadId);
    }

    // Initialize chunked upload
    async initializeChunkedUpload(task) {
        const response = await Utils.apiRequest(
            `${CONFIG.API_ENDPOINTS.files.upload}/chunked/init`,
            'POST',
            {
                fileName: task.file.name,
                fileSize: task.file.size,
                path: window.fileManager ? window.fileManager.getCurrentPath() : '/'
            }
        );
        
        return response.uploadId;
    }

    // Upload chunk
    async uploadChunk(task, uploadId, chunkIndex, chunk) {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex);
        
        return Utils.apiRequest(
            `${CONFIG.API_ENDPOINTS.files.upload}/chunked/upload`,
            'POST',
            formData
        );
    }

    // Complete chunked upload
    async completeChunkedUpload(task, uploadId) {
        return Utils.apiRequest(
            `${CONFIG.API_ENDPOINTS.files.upload}/chunked/complete`,
            'POST',
            { uploadId: uploadId }
        );
    }

    // 🔥 업로드 성공 후 파일매니저 새로고침 (특정 경로에 대해)
    refreshFileManagerAfterUpload(uploadPath) {
        console.log('🔄 Refreshing file manager after upload to path:', uploadPath);
        
        if (!window.fileManager) {
            console.warn('⚠️ FileManager not available for refresh');
            return;
        }
        
        try {
            // 현재 fileManager의 경로 확인
            const currentManagerPath = window.fileManager.getCurrentPath();
            console.log('📁 Current manager path:', currentManagerPath);
            console.log('📂 Upload path:', uploadPath);
            
            // 🔥 경로가 일치하는 경우에만 새로고침
            if (currentManagerPath === uploadPath) {
                console.log('✅ Paths match - refreshing current view');
                
                // 현재 경로의 파일 목록 새로고침
                window.fileManager.loadFiles(uploadPath).then(() => {
                    // 🔥 FIXED: 새로고침 후 검증
                    console.log('🔍 업로드 후 새로고침 검증:');
                    const currentFiles = window.fileManager.getCurrentFiles();
                    console.log('  📊 현재 표시된 파일 수:', currentFiles.length);
                    console.log('  📂 표시된 파일들:');
                    currentFiles.forEach(file => {
                        console.log(`    ${file.isFolder ? '📁' : '📄'} ${file.name} (경로: ${file.path})`);
                    });
                });
                
                window.fileManager.loadStorageInfo();
                
                // 성공 알림 (선택적)
                setTimeout(() => {
                    console.log('🎉 File list refreshed for current folder');
                }, 500);
                
            } else {
                console.log('📍 Upload path differs from current path - no UI refresh needed');
                console.log('  📁 Current:', currentManagerPath);
                console.log('  📂 Upload:', uploadPath);
                
                // 다른 폴더에 업로드된 경우, 스토리지 정보만 업데이트
                window.fileManager.loadStorageInfo();
            }
            
        } catch (error) {
            console.error('❌ Error refreshing file manager:', error);
            
            // 폴백: 기본 새로고침
            try {
                window.fileManager.loadFiles();
                window.fileManager.loadStorageInfo();
                console.log('🔄 Fallback refresh completed');
            } catch (fallbackError) {
                console.error('❌ Fallback refresh also failed:', fallbackError);
            }
        }
    }
}

// Initialize upload manager
window.addEventListener('DOMContentLoaded', () => {
    window.uploadManager = new UploadManager();
    
    // Setup paste event listener
    document.addEventListener('paste', (e) => {
        window.uploadManager.handlePaste(e);
    });
});

// Export globally
window.uploadManager = new UploadManager();