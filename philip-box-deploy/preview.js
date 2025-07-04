// Preview Manager
class PreviewManager {
    constructor() {
        this.currentFile = null;
        this.previewModal = null;
        this.previewContainer = null;
        this.previewTitle = null;
        
        this.initializePreviewManager();
    }

    // Initialize preview manager
    initializePreviewManager() {
        this.previewModal = document.getElementById('previewModal');
        this.previewContainer = document.getElementById('previewContainer');
        this.previewTitle = document.getElementById('previewTitle');
        
        this.setupEventListeners();
    }

    // Setup event listeners
    setupEventListeners() {
        // Close modal button
        const previewModalClose = document.getElementById('previewModalClose');
        if (previewModalClose) {
            previewModalClose.addEventListener('click', () => {
                this.hidePreview();
            });
        }

        // Close modal when clicking outside
        if (this.previewModal) {
            this.previewModal.addEventListener('click', (e) => {
                if (e.target === this.previewModal) {
                    this.hidePreview();
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.isPreviewOpen()) {
                switch (e.key) {
                    case 'Escape':
                        this.hidePreview();
                        break;
                    case 'ArrowLeft':
                        this.showPreviousFile();
                        break;
                    case 'ArrowRight':
                        this.showNextFile();
                        break;
                    case ' ':
                        e.preventDefault();
                        this.togglePlayback();
                        break;
                }
            }
        });
    }

    // Show preview for file
    async showPreview(file) {
        try {
            this.currentFile = file;
            
            // Update title
            if (this.previewTitle) {
                this.previewTitle.textContent = file.name;
            }

            // Clear previous content
            if (this.previewContainer) {
                this.previewContainer.innerHTML = '';
            }

            // Show loading
            this.showPreviewLoading();

            // Get preview type
            const previewType = Utils.getFileTypeForPreview(file.name);

            if (previewType) {
                await this.renderPreview(file, previewType);
            } else {
                this.showUnsupportedPreview(file);
            }

            // Show modal
            this.showPreviewModal();

        } catch (error) {
            console.error('Preview failed:', error);
            this.showPreviewError(error.message);
        }
    }

    // Render preview based on type
    async renderPreview(file, previewType) {
        switch (previewType) {
            case 'image':
                await this.renderImagePreview(file);
                break;
            case 'video':
                await this.renderVideoPreview(file);
                break;
            case 'audio':
                await this.renderAudioPreview(file);
                break;
            case 'text':
                await this.renderTextPreview(file);
                break;
            case 'pdf':
                await this.renderPdfPreview(file);
                break;
            default:
                this.showUnsupportedPreview(file);
        }
    }

    // Render image preview
    async renderImagePreview(file) {
        const imageUrl = await this.getFileUrl(file);
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = file.name;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        
        img.onload = () => {
            this.hidePreviewLoading();
        };
        
        img.onerror = () => {
            this.showPreviewError('이미지를 불러올 수 없습니다.');
        };

        // Add zoom functionality
        this.addImageZoomControls(img);
        
        this.previewContainer.appendChild(img);
    }

    // Render video preview
    async renderVideoPreview(file) {
        const videoUrl = await this.getFileUrl(file);
        
        const video = document.createElement('video');
        video.src = videoUrl;
        video.controls = true;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        
        video.onloadeddata = () => {
            this.hidePreviewLoading();
        };
        
        video.onerror = () => {
            this.showPreviewError('비디오를 불러올 수 없습니다.');
        };

        // Add video controls
        this.addVideoControls(video);
        
        this.previewContainer.appendChild(video);
    }

    // Render audio preview
    async renderAudioPreview(file) {
        const audioUrl = await this.getFileUrl(file);
        
        const audioContainer = document.createElement('div');
        audioContainer.className = 'audio-preview';
        audioContainer.style.textAlign = 'center';
        audioContainer.style.padding = '40px';
        
        const audioIcon = document.createElement('i');
        audioIcon.className = 'fas fa-music';
        audioIcon.style.fontSize = '64px';
        audioIcon.style.color = '#0061ff';
        audioIcon.style.marginBottom = '20px';
        audioIcon.style.display = 'block';
        
        const fileName = document.createElement('h3');
        fileName.textContent = file.name;
        fileName.style.marginBottom = '20px';
        
        const audio = document.createElement('audio');
        audio.src = audioUrl;
        audio.controls = true;
        audio.style.width = '100%';
        audio.style.maxWidth = '400px';
        
        audio.onloadeddata = () => {
            this.hidePreviewLoading();
        };
        
        audio.onerror = () => {
            this.showPreviewError('오디오를 불러올 수 없습니다.');
        };
        
        audioContainer.appendChild(audioIcon);
        audioContainer.appendChild(fileName);
        audioContainer.appendChild(audio);
        
        this.previewContainer.appendChild(audioContainer);
    }

    // Render text preview
    async renderTextPreview(file) {
        try {
            const content = await this.getFileContent(file);
            
            const textContainer = document.createElement('div');
            textContainer.className = 'text-preview';
            textContainer.style.padding = '20px';
            textContainer.style.backgroundColor = '#f8f9fa';
            textContainer.style.borderRadius = '8px';
            textContainer.style.maxHeight = '500px';
            textContainer.style.overflow = 'auto';
            
            const pre = document.createElement('pre');
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.wordWrap = 'break-word';
            pre.style.fontSize = '14px';
            pre.style.lineHeight = '1.5';
            pre.style.margin = '0';
            
            // Syntax highlighting for code files
            const ext = Utils.getFileExtension(file.name);
            if (['js', 'html', 'css', 'json', 'xml'].includes(ext)) {
                pre.className = `language-${ext}`;
                pre.textContent = content;
                this.applySyntaxHighlighting(pre);
            } else {
                pre.textContent = content;
            }
            
            textContainer.appendChild(pre);
            this.previewContainer.appendChild(textContainer);
            
            this.hidePreviewLoading();
            
        } catch (error) {
            this.showPreviewError('텍스트를 불러올 수 없습니다.');
        }
    }

    // Render PDF preview
    async renderPdfPreview(file) {
        const pdfUrl = await this.getFileUrl(file);
        
        const iframe = document.createElement('iframe');
        iframe.src = `${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`;
        iframe.style.width = '100%';
        iframe.style.height = '600px';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '8px';
        
        iframe.onload = () => {
            this.hidePreviewLoading();
        };
        
        iframe.onerror = () => {
            this.showPreviewError('PDF를 불러올 수 없습니다.');
        };
        
        this.previewContainer.appendChild(iframe);
    }

    // Show unsupported preview
    showUnsupportedPreview(file) {
        const unsupportedContainer = document.createElement('div');
        unsupportedContainer.className = 'unsupported-preview';
        unsupportedContainer.style.textAlign = 'center';
        unsupportedContainer.style.padding = '60px 20px';
        
        const icon = document.createElement('i');
        icon.className = Utils.getFileTypeIcon(file.name);
        icon.style.fontSize = '64px';
        icon.style.color = '#9aa0a6';
        icon.style.marginBottom = '20px';
        icon.style.display = 'block';
        
        const title = document.createElement('h3');
        title.textContent = '미리보기를 지원하지 않는 파일입니다';
        title.style.marginBottom = '10px';
        title.style.color = '#3d464d';
        
        const subtitle = document.createElement('p');
        subtitle.textContent = '파일을 다운로드하여 확인하세요';
        subtitle.style.color = '#9aa0a6';
        subtitle.style.marginBottom = '20px';
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-primary';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> 다운로드';
        downloadBtn.addEventListener('click', () => {
            window.fileManager.downloadFile(file);
        });
        
        unsupportedContainer.appendChild(icon);
        unsupportedContainer.appendChild(title);
        unsupportedContainer.appendChild(subtitle);
        unsupportedContainer.appendChild(downloadBtn);
        
        this.previewContainer.appendChild(unsupportedContainer);
        this.hidePreviewLoading();
    }

    // Show preview loading
    showPreviewLoading() {
        if (!this.previewContainer) return;
        
        const loading = document.createElement('div');
        loading.className = 'preview-loading';
        loading.style.display = 'flex';
        loading.style.alignItems = 'center';
        loading.style.justifyContent = 'center';
        loading.style.minHeight = '200px';
        
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        
        loading.appendChild(spinner);
        this.previewContainer.appendChild(loading);
    }

    // Hide preview loading
    hidePreviewLoading() {
        if (!this.previewContainer) return;
        
        const loading = this.previewContainer.querySelector('.preview-loading');
        if (loading) {
            loading.remove();
        }
    }

    // Show preview error
    showPreviewError(message) {
        if (!this.previewContainer) return;
        
        this.previewContainer.innerHTML = '';
        
        const errorContainer = document.createElement('div');
        errorContainer.className = 'preview-error';
        errorContainer.style.textAlign = 'center';
        errorContainer.style.padding = '60px 20px';
        errorContainer.style.color = '#dc3545';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-exclamation-triangle';
        icon.style.fontSize = '48px';
        icon.style.marginBottom = '20px';
        icon.style.display = 'block';
        
        const text = document.createElement('p');
        text.textContent = message;
        text.style.fontSize = '16px';
        
        errorContainer.appendChild(icon);
        errorContainer.appendChild(text);
        
        this.previewContainer.appendChild(errorContainer);
    }

    // Get file URL for preview
    async getFileUrl(file) {
        try {
            const response = await Utils.apiRequest(
                `${CONFIG.API_ENDPOINTS.files.download}/${file.id}?preview=true`
            );
            return response.downloadUrl;
        } catch (error) {
            throw new Error('파일 URL을 가져올 수 없습니다.');
        }
    }

    // Get file content for text preview
    async getFileContent(file) {
        try {
            const url = await this.getFileUrl(file);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('파일을 읽을 수 없습니다.');
            }
            
            return await response.text();
        } catch (error) {
            throw new Error('파일 내용을 가져올 수 없습니다.');
        }
    }

    // Add image zoom controls
    addImageZoomControls(img) {
        let scale = 1;
        let isDragging = false;
        let startX, startY;
        let translateX = 0, translateY = 0;
        
        img.style.transition = 'transform 0.3s ease';
        img.style.cursor = 'grab';
        
        // Zoom with mouse wheel
        img.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale *= delta;
            scale = Math.max(0.5, Math.min(scale, 5));
            
            img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        });
        
        // Pan with mouse drag
        img.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            img.style.cursor = 'grabbing';
            img.style.transition = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                img.style.cursor = 'grab';
                img.style.transition = 'transform 0.3s ease';
            }
        });
        
        // Reset on double click
        img.addEventListener('dblclick', () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            img.style.transform = 'translate(0px, 0px) scale(1)';
        });
    }

    // Add video controls
    addVideoControls(video) {
        // Custom video controls could be added here
        video.addEventListener('loadedmetadata', () => {
            // Video loaded, ready to play
        });
        
        video.addEventListener('error', (e) => {
            console.error('Video error:', e);
        });
    }

    // Apply syntax highlighting
    applySyntaxHighlighting(element) {
        // Basic syntax highlighting implementation
        // For a full implementation, you could use libraries like Prism.js or highlight.js
        
        const code = element.textContent;
        const ext = element.className.replace('language-', '');
        
        // Simple highlighting for demonstration
        if (ext === 'json') {
            try {
                const parsed = JSON.parse(code);
                element.innerHTML = this.highlightJson(JSON.stringify(parsed, null, 2));
            } catch (e) {
                // Keep original if not valid JSON
            }
        }
    }

    // Simple JSON highlighting
    highlightJson(json) {
        return json
            .replace(/("[\w\s]*"):/g, '<span style="color: #0066cc;">$1</span>:')
            .replace(/: (".*?")/g, ': <span style="color: #008000;">$1</span>')
            .replace(/: (true|false|null)/g, ': <span style="color: #800080;">$1</span>')
            .replace(/: (\d+)/g, ': <span style="color: #ff6600;">$1</span>');
    }

    // Show preview modal
    showPreviewModal() {
        if (this.previewModal) {
            this.previewModal.classList.add('active');
        }
    }

    // Hide preview
    hidePreview() {
        if (this.previewModal) {
            this.previewModal.classList.remove('active');
        }
        
        // Clean up media elements
        this.cleanupMediaElements();
        
        this.currentFile = null;
    }

    // Cleanup media elements
    cleanupMediaElements() {
        if (!this.previewContainer) return;
        
        const videos = this.previewContainer.querySelectorAll('video');
        const audios = this.previewContainer.querySelectorAll('audio');
        
        videos.forEach(video => {
            video.pause();
            video.src = '';
            video.load();
        });
        
        audios.forEach(audio => {
            audio.pause();
            audio.src = '';
            audio.load();
        });
    }

    // Check if preview is open
    isPreviewOpen() {
        return this.previewModal && this.previewModal.classList.contains('active');
    }

    // Show previous file
    showPreviousFile() {
        if (!this.currentFile || !window.fileManager) return;
        
        const files = window.fileManager.getCurrentFiles();
        const currentIndex = files.findIndex(f => f.id === this.currentFile.id);
        
        if (currentIndex > 0) {
            const previousFile = files[currentIndex - 1];
            if (!previousFile.isFolder) {
                this.showPreview(previousFile);
            }
        }
    }

    // Show next file
    showNextFile() {
        if (!this.currentFile || !window.fileManager) return;
        
        const files = window.fileManager.getCurrentFiles();
        const currentIndex = files.findIndex(f => f.id === this.currentFile.id);
        
        if (currentIndex < files.length - 1) {
            const nextFile = files[currentIndex + 1];
            if (!nextFile.isFolder) {
                this.showPreview(nextFile);
            }
        }
    }

    // Toggle playback for video/audio
    togglePlayback() {
        if (!this.previewContainer) return;
        
        const video = this.previewContainer.querySelector('video');
        const audio = this.previewContainer.querySelector('audio');
        
        if (video) {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
        
        if (audio) {
            if (audio.paused) {
                audio.play();
            } else {
                audio.pause();
            }
        }
    }

    // Get current file
    getCurrentFile() {
        return this.currentFile;
    }

    // Download current file
    downloadCurrentFile() {
        if (this.currentFile && window.fileManager) {
            window.fileManager.downloadFile(this.currentFile);
        }
    }
}

// Initialize preview manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.previewManager = new PreviewManager();
});

// Export PreviewManager
window.PreviewManager = PreviewManager; 