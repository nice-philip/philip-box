// API Configuration - 환경에 따라 자동 설정
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8080/api'
    : 'https://philip-box.onrender.com/api';

const API_ENDPOINTS = {
    auth: {
        login: `${API_BASE_URL}/auth/login`,
        register: `${API_BASE_URL}/auth/register`,
        logout: `${API_BASE_URL}/auth/logout`,
        profile: `${API_BASE_URL}/auth/profile`
    },
    files: {
        list: `${API_BASE_URL}/files`,
        upload: `${API_BASE_URL}/files/upload`,
        download: `${API_BASE_URL}/files/download`,
        delete: `${API_BASE_URL}/files/delete`,
        rename: `${API_BASE_URL}/files/rename`,
        move: `${API_BASE_URL}/files/move`,
        create_folder: `${API_BASE_URL}/files/folder`,
        share: `${API_BASE_URL}/files/share`,
        search: `${API_BASE_URL}/files/search`,
        details: `${API_BASE_URL}/files/details`,
        thumbnail: `${API_BASE_URL}/files/thumbnail`,
        important: `${API_BASE_URL}/files/important`,
        recent: `${API_BASE_URL}/files/recent`,
        shared: `${API_BASE_URL}/files/shared`,
        ai_search: `${API_BASE_URL}/files/ai-search`
    },
    storage: {
        usage: `${API_BASE_URL}/storage/usage`
    }
};

// App Constants
const APP_CONFIG = {
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    CHUNK_SIZE: 1024 * 1024, // 1MB chunks for upload
    ALLOWED_FILE_TYPES: [
        // Images
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Text
        'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
        // Archives
        'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
        // Audio/Video
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm', 'video/ogg'
    ],
    DEFAULT_STORAGE_QUOTA: 2 * 1024 * 1024 * 1024, // 2GB
    SUPPORTED_PREVIEW_TYPES: {
        image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
        video: ['mp4', 'webm', 'ogg'],
        audio: ['mp3', 'wav', 'ogg'],
        text: ['txt', 'csv', 'html', 'css', 'js', 'json', 'xml'],
        pdf: ['pdf']
    },
    THUMBNAIL_CONFIG: {
        enabled: true,
        maxWidth: 200,
        maxHeight: 200,
        quality: 0.8,
        supportedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'mp4', 'webm', 'ogg']
    },
    SHARE_CONFIG: {
        defaultPermission: 'view',
        allowPublicSharing: true,
        maxExpiryDays: 365,
        enablePasswordProtection: true
    },
    SEARCH_CONFIG: {
        enableAISearch: true,
        maxResults: 50,
        searchDelay: 300
    }
};

// File Type Icons Mapping
const FILE_TYPE_ICONS = {
    // Folders
    folder: 'fas fa-folder',
    
    // Images
    jpg: 'fas fa-image', jpeg: 'fas fa-image', png: 'fas fa-image', 
    gif: 'fas fa-image', webp: 'fas fa-image', bmp: 'fas fa-image',
    
    // Documents
    pdf: 'fas fa-file-pdf',
    doc: 'fas fa-file-word', docx: 'fas fa-file-word',
    xls: 'fas fa-file-excel', xlsx: 'fas fa-file-excel',
    ppt: 'fas fa-file-powerpoint', pptx: 'fas fa-file-powerpoint',
    
    // Text
    txt: 'fas fa-file-alt', csv: 'fas fa-file-csv',
    html: 'fas fa-file-code', css: 'fas fa-file-code', 
    js: 'fas fa-file-code', json: 'fas fa-file-code',
    xml: 'fas fa-file-code',
    
    // Archives
    zip: 'fas fa-file-archive', rar: 'fas fa-file-archive',
    '7z': 'fas fa-file-archive',
    
    // Audio/Video
    mp3: 'fas fa-file-audio', wav: 'fas fa-file-audio', ogg: 'fas fa-file-audio',
    mp4: 'fas fa-file-video', webm: 'fas fa-file-video', avi: 'fas fa-file-video',
    
    // Default
    default: 'fas fa-file'
};

// Error Messages
const ERROR_MESSAGES = {
    NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
    UNAUTHORIZED: '인증이 필요합니다.',
    FORBIDDEN: '접근 권한이 없습니다.',
    NOT_FOUND: '파일을 찾을 수 없습니다.',
    FILE_TOO_LARGE: '파일 크기가 너무 큽니다.',
    INVALID_FILE_TYPE: '지원하지 않는 파일 형식입니다.',
    UPLOAD_FAILED: '업로드에 실패했습니다.',
    DOWNLOAD_FAILED: '다운로드에 실패했습니다.',
    DELETE_FAILED: '삭제에 실패했습니다.',
    RENAME_FAILED: '이름 변경에 실패했습니다.',
    MOVE_FAILED: '이동에 실패했습니다.',
    FOLDER_CREATE_FAILED: '폴더 생성에 실패했습니다.',
    SHARE_FAILED: '공유에 실패했습니다.',
    SEARCH_FAILED: '검색에 실패했습니다.',
    STORAGE_FULL: '저장 공간이 부족합니다.',
    INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
    REGISTRATION_FAILED: '회원가입에 실패했습니다.',
    PASSWORD_MISMATCH: '비밀번호가 일치하지 않습니다.',
    AI_SEARCH_FAILED: 'AI 검색에 실패했습니다.',
    THUMBNAIL_GENERATION_FAILED: '썸네일 생성에 실패했습니다.',
    SHARE_LINK_GENERATION_FAILED: '공유 링크 생성에 실패했습니다.'
};

// Success Messages
const SUCCESS_MESSAGES = {
    UPLOAD_SUCCESS: '파일이 업로드되었습니다.',
    DOWNLOAD_SUCCESS: '파일이 다운로드되었습니다.',
    DELETE_SUCCESS: '파일이 삭제되었습니다.',
    RENAME_SUCCESS: '파일 이름이 변경되었습니다.',
    MOVE_SUCCESS: '파일이 이동되었습니다.',
    FOLDER_CREATE_SUCCESS: '폴더가 생성되었습니다.',
    SHARE_SUCCESS: '파일이 공유되었습니다.',
    LOGIN_SUCCESS: '로그인되었습니다.',
    LOGOUT_SUCCESS: '로그아웃되었습니다.',
    REGISTRATION_SUCCESS: '회원가입이 완료되었습니다.',
    SHARE_LINK_COPIED: '공유 링크가 복사되었습니다.',
    IMPORTANT_MARKED: '중요 표시되었습니다.',
    IMPORTANT_UNMARKED: '중요 표시가 해제되었습니다.',
    DESCRIPTION_SAVED: '설명이 저장되었습니다.'
};

// Local Storage Keys
const STORAGE_KEYS = {
    TOKEN: 'dropbox_token',
    USER: 'dropbox_user',
    PREFERENCES: 'dropbox_preferences',
    RECENT_FILES: 'dropbox_recent_files',
    IMPORTANT_FILES: 'dropbox_important_files',
    SEARCH_HISTORY: 'dropbox_search_history'
};

// View Modes
const VIEW_MODES = {
    GRID: 'grid',
    LIST: 'list'
};

// File Sections
const FILE_SECTIONS = {
    FILES: 'files',
    SHARED: 'shared',
    RECENT: 'recent',
    IMPORTANT: 'important',
    DELETED: 'deleted'
};

// Share Types
const SHARE_TYPES = {
    PRIVATE: 'private',
    PUBLIC: 'public'
};

// Share Permissions
const SHARE_PERMISSIONS = {
    VIEW: 'view',
    EDIT: 'edit',
    COMMENT: 'comment'
};

// Export configuration object
window.CONFIG = {
    API_BASE_URL,
    API_ENDPOINTS,
    APP_CONFIG,
    FILE_TYPE_ICONS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    STORAGE_KEYS,
    VIEW_MODES,
    FILE_SECTIONS,
    SHARE_TYPES,
    SHARE_PERMISSIONS
}; 