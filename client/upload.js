// Upload Manager
class UploadManager {
    constructor() {
        this.currentUploads = [];
        this.uploadQueue = [];
        this.maxConcurrentUploads = 3;
        this.isUploading = false;
        
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
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                    this.handleFileUpload(files);
                }
                // Reset file input
                e.target.value = '';
            });
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
            if (e.key === 'Escape') {
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
            this.isUploading = false;
            this.hideUploadArea();
            Utils.showNotification('모든 파일 업로드가 완료되었습니다.');
            
            // Refresh file list
            if (window.fileManager) {
                await window.fileManager.loadFiles();
                await window.fileManager.loadStorageInfo();
            }
        }
    }

    // Upload single file
    async uploadFile(task) {
        try {
            task.status = 'uploading';
            task.startTime = Date.now();
            
            this.updateUploadProgress(task);

            // Check if file needs chunked upload
            if (task.file.size > CONFIG.APP_CONFIG.CHUNK_SIZE) {
                await this.uploadFileChunked(task);
            } else {
                await this.uploadFileSimple(task);
            }

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

    // Upload file with chunking
    async uploadFileChunked(task) {
        const { file } = task;
        const chunkSize = CONFIG.APP_CONFIG.CHUNK_SIZE;
        
        // Initialize chunked upload
        const initResponse = await Utils.apiRequest(CONFIG.API_ENDPOINTS.files.upload, {
            method: 'POST',
            body: JSON.stringify({
                filename: file.name,
                fileSize: file.size,
                chunkSize: chunkSize,
                totalChunks: task.totalChunks,
                path: window.fileManager.getCurrentPath(),
                uploadType: 'chunked'
            })
        });

        const uploadId = initResponse.uploadId;

        // Upload chunks
        for (let i = 0; i < task.totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);

            await this.uploadChunk(task, uploadId, i, chunk);
            
            task.chunkIndex = i + 1;
            task.uploadedBytes = end;
            task.progress = Math.round((task.uploadedBytes / task.totalBytes) * 100);
            
            this.updateUploadProgress(task);
        }

        // Complete chunked upload
        await Utils.apiRequest(`${CONFIG.API_ENDPOINTS.files.upload}/${uploadId}/complete`, {
            method: 'POST'
        });
    }

    // Upload single chunk
    async uploadChunk(task, uploadId, chunkIndex, chunk) {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', chunkIndex);

        const response = await fetch(`${CONFIG.API_ENDPOINTS.files.upload}/${uploadId}/chunk`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN)}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Chunk upload failed');
        }
    }

    // Upload file without chunking
    async uploadFileSimple(task) {
        const { file } = task;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', window.fileManager.getCurrentPath());

        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    task.progress = Math.round((e.loaded / e.total) * 100);
                    task.uploadedBytes = e.loaded;
                    this.updateUploadProgress(task);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed: Network error'));
            });

            xhr.addEventListener('timeout', () => {
                reject(new Error('Upload failed: Timeout'));
            });

            xhr.open('POST', CONFIG.API_ENDPOINTS.files.upload);
            xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN)}`);
            xhr.timeout = 300000; // 5 minutes timeout
            xhr.send(formData);
        });
    }

    // Update upload progress UI
    updateUploadProgress(task) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        if (progressFill) {
            progressFill.style.width = task.progress + '%';
        }

        if (progressText) {
            const statusText = this.getStatusText(task);
            progressText.textContent = statusText;
        }
    }

    // Get status text for upload
    getStatusText(task) {
        switch (task.status) {
            case 'pending':
                return `${task.file.name} - 대기 중...`;
            case 'uploading':
                const speed = this.calculateUploadSpeed(task);
                const eta = this.calculateETA(task);
                return `${task.file.name} - ${task.progress}% (${speed}, ${eta})`;
            case 'completed':
                return `${task.file.name} - 완료`;
            case 'failed':
                return `${task.file.name} - 실패: ${task.error}`;
            default:
                return `${task.file.name}`;
        }
    }

    // Calculate upload speed
    calculateUploadSpeed(task) {
        if (!task.startTime || task.uploadedBytes === 0) return '계산 중...';
        
        const elapsed = (Date.now() - task.startTime) / 1000; // seconds
        const speed = task.uploadedBytes / elapsed; // bytes per second
        
        return Utils.formatFileSize(speed) + '/s';
    }

    // Calculate ETA
    calculateETA(task) {
        if (!task.startTime || task.uploadedBytes === 0) return '계산 중...';
        
        const elapsed = (Date.now() - task.startTime) / 1000; // seconds
        const speed = task.uploadedBytes / elapsed; // bytes per second
        const remaining = task.totalBytes - task.uploadedBytes;
        const eta = remaining / speed; // seconds
        
        if (eta < 60) {
            return Math.round(eta) + '초';
        } else if (eta < 3600) {
            return Math.round(eta / 60) + '분';
        } else {
            return Math.round(eta / 3600) + '시간';
        }
    }

    // Remove from current uploads
    removeFromCurrentUploads(task) {
        const index = this.currentUploads.findIndex(t => t.id === task.id);
        if (index !== -1) {
            this.currentUploads.splice(index, 1);
        }
        
        // Process next in queue
        setTimeout(() => this.processUploadQueue(), 100);
    }

    // Show upload area
    showUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        const uploadZone = document.getElementById('uploadZone');
        const uploadProgress = document.getElementById('uploadProgress');

        if (uploadArea) {
            uploadArea.classList.add('active');
        }

        if (uploadZone) {
            uploadZone.style.display = 'block';
        }

        if (uploadProgress) {
            uploadProgress.style.display = 'block';
        }
    }

    // Hide upload area
    hideUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        const uploadZone = document.getElementById('uploadZone');
        const uploadProgress = document.getElementById('uploadProgress');

        if (uploadArea) {
            uploadArea.classList.remove('active');
        }

        if (uploadZone) {
            uploadZone.style.display = 'none';
        }

        if (uploadProgress) {
            uploadProgress.style.display = 'none';
        }
    }

    // Cancel upload
    cancelUpload(taskId) {
        // Remove from queue
        this.uploadQueue = this.uploadQueue.filter(task => task.id !== taskId);
        
        // Cancel current upload if exists
        const currentTask = this.currentUploads.find(task => task.id === taskId);
        if (currentTask) {
            currentTask.status = 'cancelled';
            this.removeFromCurrentUploads(currentTask);
        }
    }

    // Cancel all uploads
    cancelAllUploads() {
        this.uploadQueue = [];
        this.currentUploads.forEach(task => {
            task.status = 'cancelled';
        });
        this.currentUploads = [];
        this.isUploading = false;
        this.hideUploadArea();
    }

    // Get upload statistics
    getUploadStats() {
        const completed = this.currentUploads.filter(task => task.status === 'completed').length;
        const failed = this.currentUploads.filter(task => task.status === 'failed').length;
        const pending = this.uploadQueue.length;
        const uploading = this.currentUploads.filter(task => task.status === 'uploading').length;

        return {
            completed,
            failed,
            pending,
            uploading,
            total: completed + failed + pending + uploading
        };
    }

    // Check if upload is in progress
    isUploadInProgress() {
        return this.isUploading || this.currentUploads.length > 0 || this.uploadQueue.length > 0;
    }

    // Handle paste event for file upload
    handlePaste(event) {
        const items = event.clipboardData.items;
        const files = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const file = item.getAsFile();
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
            const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.files.upload, {
                method: 'POST',
                body: JSON.stringify({
                    url: url,
                    path: window.fileManager.getCurrentPath(),
                    uploadType: 'url'
                })
            });

            Utils.showNotification('URL에서 파일을 다운로드 중입니다...');
            
            // Refresh file list after a delay
            setTimeout(async () => {
                if (window.fileManager) {
                    await window.fileManager.loadFiles();
                    await window.fileManager.loadStorageInfo();
                }
            }, 5000);

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
        }
    }

    // Retry failed upload
    retryUpload(taskId) {
        const task = this.currentUploads.find(t => t.id === taskId);
        if (task && task.status === 'failed') {
            task.status = 'pending';
            task.progress = 0;
            task.uploadedBytes = 0;
            task.chunkIndex = 0;
            task.error = null;
            
            this.uploadQueue.push(task);
            this.removeFromCurrentUploads(task);
            this.processUploadQueue();
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
}

// Initialize upload manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.uploadManager = new UploadManager();

    // Handle paste events for file upload
    document.addEventListener('paste', (e) => {
        window.uploadManager.handlePaste(e);
    });

    // Prevent default drag behaviors
    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
    });

    // Handle beforeunload to warn about ongoing uploads
    window.addEventListener('beforeunload', (e) => {
        if (window.uploadManager.isUploadInProgress()) {
            const message = '업로드가 진행 중입니다. 페이지를 떠나시겠습니까?';
            e.preventDefault();
            e.returnValue = message;
            return message;
        }
    });
});

// Export UploadManager
window.UploadManager = UploadManager; 