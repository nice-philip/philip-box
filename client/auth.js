// Authentication Manager
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.initializationComplete = false;
        this.initializeAuth();
    }

    // Initialize authentication
    async initializeAuth() {
        console.log('🔥 ===== STARTING AUTH INITIALIZATION =====');
        
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        const user = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

        console.log('🔍 Auth check - Token exists:', !!token, 'User exists:', !!user);

        if (token && user) {
            try {
                console.log('✅ Token and user found, setting up login state...');
                
                // Parse user data first
                this.currentUser = JSON.parse(user);
                this.isLoggedIn = true;
                this.initializationComplete = true; // Set this immediately
                
                console.log('✅ Auth data loaded, user:', this.currentUser.email);
                
                // Force UI update multiple times to ensure it takes
                this.forceLoginState();
                
                // Set a timer to keep forcing the state
                let updateCount = 0;
                const forceUpdate = () => {
                    this.forceLoginState();
                    updateCount++;
                    
                    if (updateCount < 10) { // Try 10 times over 5 seconds
                        setTimeout(forceUpdate, 500);
                    }
                };
                forceUpdate();
                
                // Load user data and files
                setTimeout(async () => {
                    await this.loadUserDataAndFiles();
                }, 200);
                
                // Dispatch auth initialized event
                this.dispatchAuthEvent('auth-initialized', { authenticated: true });
                
                console.log('✅ Auth initialization COMPLETE - User is logged in');
                
            } catch (error) {
                console.error('❌ Auth initialization error:', error);
                this.handleAuthError();
            }
        } else {
            console.log('❌ No valid auth data found, showing login');
            this.handleAuthError();
        }
    }

    // Force login state with maximum persistence
    forceLoginState() {
        console.log('🔧 FORCING login state...');
        
        // Set authentication flags
        this.isLoggedIn = true;
        this.initializationComplete = true;
        
        // Force body classes
        document.body.classList.remove('logged-out');
        document.body.classList.add('logged-in');
        
        // Force hide login modal
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'none !important';
            loginModal.classList.remove('active');
            loginModal.setAttribute('hidden', 'true');
        }
        
        // Force show main content
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.display = 'flex !important';
            mainContent.style.visibility = 'visible !important';
            mainContent.style.opacity = '1 !important';
            mainContent.removeAttribute('hidden');
        }
        
        // Update user info with retries
        this.updateUserInfoPersistent();
        
        // Enable all interface elements
        this.enableInterface();
        
        console.log('✅ Login state FORCED');
    }

    // Update user info with persistent retries
    updateUserInfoPersistent() {
        if (!this.currentUser) return;
        
        const updateInfo = () => {
            const userAvatar = document.getElementById('userAvatar');
            const userName = document.getElementById('userName');
            const userEmail = document.getElementById('userEmail');
            
            if (userAvatar) {
                if (this.currentUser.avatar) {
                    userAvatar.innerHTML = `<img src="${this.currentUser.avatar}" alt="${this.currentUser.name}">`;
                } else {
                    const initials = this.currentUser.name ? 
                        this.currentUser.name.charAt(0).toUpperCase() : 
                        this.currentUser.email.charAt(0).toUpperCase();
                    userAvatar.textContent = initials;
                }
                userAvatar.style.display = 'flex';
            }
            
            if (userName) {
                userName.textContent = this.currentUser.name || this.currentUser.email.split('@')[0];
                userName.style.display = 'block';
            }
            
            if (userEmail) {
                userEmail.textContent = this.currentUser.email;
                userEmail.style.display = 'block';
            }
        };
        
        // Try multiple times with different intervals
        updateInfo();
        setTimeout(updateInfo, 100);
        setTimeout(updateInfo, 300);
        setTimeout(updateInfo, 500);
        setTimeout(updateInfo, 1000);
        setTimeout(updateInfo, 2000);
    }

    // Load user data and files with error handling
    async loadUserDataAndFiles() {
        try {
            console.log('📂 Loading user data and files...');
            
            // Wait for file manager to be available with multiple retries
            const fileManager = await this.waitForFileManager();
            
            if (fileManager) {
                console.log('✅ File manager available, loading files...');
                
                // Load files first
                await fileManager.loadFiles();
                console.log('✅ Files loaded');
                
                // Load storage info
                await fileManager.loadStorageInfo();
                console.log('✅ Storage info loaded');
                
                // Force UI refresh to show loaded files
                if (typeof fileManager.renderFiles === 'function') {
                    fileManager.renderFiles();
                    console.log('✅ Files rendered');
                }
                
                // Check for URL parameters
                const urlParams = new URLSearchParams(window.location.search);
                const pathParam = urlParams.get('path');
                const sectionParam = urlParams.get('section');
                
                if (pathParam || sectionParam) {
                    console.log('🔗 Loading from URL parameters');
                    fileManager.loadFolderFromUrl();
                }
                
                console.log('✅ All user data and files loaded successfully');
                
            } else {
                console.error('❌ File manager not available after multiple retries');
                // Try to initialize file manager manually
                this.tryInitializeFileManager();
            }
            
        } catch (error) {
            console.error('❌ Failed to load user data:', error);
            
            // Don't logout for data loading errors, but try to recover
            console.log('📝 Data loading failed but keeping user logged in, attempting recovery...');
            
            // Try to recover after a delay
            setTimeout(() => {
                this.loadUserDataAndFiles();
            }, 2000);
        }
    }

    // Wait for file manager to be available with multiple retries
    async waitForFileManager(maxRetries = 50, retryDelay = 200) {
        console.log('⏳ Waiting for file manager to be available...');
        
        for (let i = 0; i < maxRetries; i++) {
            if (window.fileManager) {
                console.log(`✅ File manager found after ${i + 1} attempts`);
                return window.fileManager;
            }
            
            console.log(`⏳ Attempt ${i + 1}/${maxRetries} - File manager not ready yet`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        console.warn(`⚠️ File manager not available after ${maxRetries} attempts`);
        return null;
    }

    // Try to manually initialize file manager
    async tryInitializeFileManager() {
        console.log('🔧 Attempting to manually initialize file manager...');
        
        try {
            // Check if FileManager class is available
            if (typeof FileManager !== 'undefined') {
                console.log('✅ FileManager class found, creating instance...');
                window.fileManager = new FileManager();
                
                // Give it a moment to initialize
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Try loading files again
                await this.loadUserDataAndFiles();
            } else {
                console.error('❌ FileManager class not available');
            }
        } catch (error) {
            console.error('❌ Failed to manually initialize file manager:', error);
        }
    }

    // Validate token silently in background
    async validateTokenSilently() {
        try {
            const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.auth.profile);
            
            if (response && response.user) {
                // Update user info if needed
                this.currentUser = response.user;
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(this.currentUser));
                this.updateUI();
                console.log('✓ Token validation successful');
            }
            
        } catch (error) {
            console.warn('Token validation failed (API not available):', error);
            
            // In demo mode, keep user logged in if local token exists
            const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
            const user = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
            
            if (token && user) {
                console.log('API not available, but keeping user logged in with local token');
                this.currentUser = JSON.parse(user);
                this.isLoggedIn = true;
                this.updateUI();
                return;
            }
            
            // Only logout if it's a clear auth error AND no local token
            if ((error.status === 401 || error.status === 403) && !token) {
                console.log('Token expired or invalid, logging out');
                this.logout();
            }
            // For other errors (network, 500, etc.), keep user logged in
        }
    }

    // Validate token with server (original method for explicit validation)
    async validateToken() {
        try {
            const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.auth.profile);
            this.currentUser = response.user;
            this.updateUI();
        } catch (error) {
            console.error('Token validation failed:', error);
            this.logout();
        }
    }

    // Login user
    async login(email, password) {
        try {
            Utils.showLoading(true);

            try {
                const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.auth.login, {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });

                // Store user data from API
                localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, response.token);
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.user));

                this.currentUser = response.user;
                this.isLoggedIn = true;

            } catch (apiError) {
                console.warn('API login failed, using demo mode:', apiError);
                
                // Demo mode: validate basic credentials and create local user
                if (email && password && email.includes('@') && password.length >= 1) {
                    const demoUser = {
                        id: 'demo-user-' + Date.now(),
                        name: email.split('@')[0],
                        email: email,
                        avatar: null
                    };
                    
                    const demoToken = 'demo-token-' + Date.now();
                    
                    localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, demoToken);
                    localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(demoUser));
                    
                    this.currentUser = demoUser;
                    this.isLoggedIn = true;
                    
                    console.log('Demo login successful for:', email);
                } else {
                    throw new Error('이메일과 비밀번호를 올바르게 입력해주세요.');
                }
            }

            // Update UI
            this.updateUI();
            this.hideLoginModal();

            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.LOGIN_SUCCESS);
            
            // Load initial data
            await this.loadInitialData();

        } catch (error) {
            console.error('Login failed:', error);
            Utils.showNotification(error.message || CONFIG.ERROR_MESSAGES.INVALID_CREDENTIALS, 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Register user
    async register(name, email, password) {
        try {
            Utils.showLoading(true);

            const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.auth.register, {
                method: 'POST',
                body: JSON.stringify({ name, email, password })
            });

            // Store user data
            localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, response.token);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.user));

            this.currentUser = response.user;
            this.isLoggedIn = true;

            // Update UI
            this.updateUI();
            this.hideRegisterModal();

            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.REGISTRATION_SUCCESS);
            
            // Load initial data
            await this.loadInitialData();

        } catch (error) {
            console.error('Registration failed:', error);
            Utils.showNotification(error.message || CONFIG.ERROR_MESSAGES.REGISTRATION_FAILED, 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Logout user
    async logout() {
        try {
            // Call logout API if user is logged in
            if (this.isLoggedIn) {
                await Utils.apiRequest(CONFIG.API_ENDPOINTS.auth.logout, {
                    method: 'POST'
                });
            }
        } catch (error) {
            console.error('Logout API call failed:', error);
        } finally {
            // Clear local storage
            localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
            localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
            localStorage.removeItem(CONFIG.STORAGE_KEYS.PREFERENCES);
            localStorage.removeItem(CONFIG.STORAGE_KEYS.RECENT_FILES);

            this.currentUser = null;
            this.isLoggedIn = false;

            // Update UI
            this.updateUI();
            this.showLoginModal();

            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.LOGOUT_SUCCESS);
        }
    }

    // Show main content
    showMainContent() {
        console.log('Showing main content...');
        
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.display = 'flex';
            mainContent.style.visibility = 'visible';
            mainContent.style.opacity = '1';
            console.log('✓ Main content shown');
        }
    }

    // Hide main content
    hideMainContent() {
        console.log('Hiding main content...');
        
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.display = 'none';
            mainContent.style.visibility = 'hidden';
            mainContent.style.opacity = '0';
            console.log('✓ Main content hidden');
        }
    }

    // Enable interface elements
    enableInterface() {
        const buttons = document.querySelectorAll('button:not(.modal-close)');
        const inputs = document.querySelectorAll('input:not([id*="login"]):not([id*="register"])');
        
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        
        inputs.forEach(input => {
            input.disabled = false;
            input.style.opacity = '1';
        });
    }

    // Disable interface elements
    disableInterface() {
        const buttons = document.querySelectorAll('button:not(.modal-close):not([id*="login"]):not([id*="register"])');
        const inputs = document.querySelectorAll('input:not([id*="login"]):not([id*="register"])');
        
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });
        
        inputs.forEach(input => {
            input.disabled = true;
            input.style.opacity = '0.5';
        });
    }

    // Show login modal
    showLoginModal() {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'flex';
            loginModal.classList.add('active');
        }
    }

    // Hide login modal
    hideLoginModal() {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'none';
            loginModal.classList.remove('active');
        }
    }

    // Show register modal
    showRegisterModal() {
        const registerModal = document.getElementById('registerModal');
        if (registerModal) {
            registerModal.style.display = 'flex';
            registerModal.classList.add('active');
        }
    }

    // Hide register modal
    hideRegisterModal() {
        const registerModal = document.getElementById('registerModal');
        if (registerModal) {
            registerModal.style.display = 'none';
            registerModal.classList.remove('active');
        }
    }

    // Load initial data after login/register
    async loadInitialData() {
        try {
            // Only load if fileManager is available
            if (window.fileManager) {
                // Check if we have URL parameters to load a specific folder
                const urlParams = new URLSearchParams(window.location.search);
                const pathParam = urlParams.get('path');
                const sectionParam = urlParams.get('section');
                
                if (pathParam || sectionParam) {
                    console.log('Loading initial data from URL parameters');
                    // Let fileManager handle URL-based navigation
                    window.fileManager.loadFolderFromUrl();
                } else {
                    // Load default data
                    await window.fileManager.loadFiles();
                }
                
                await window.fileManager.loadStorageInfo();
            }
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.isLoggedIn;
    }

    // Handle authentication errors
    handleAuthError() {
        console.log('Handling auth error...');
        
        // Clear auth data
        this.currentUser = null;
        this.isLoggedIn = false;
        this.initializationComplete = true; // Mark as complete even on error
        
        // Clear storage
        localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
        
        // Update UI
        this.updateUI();
        this.hideMainContent();
        this.showLoginModal();
        this.disableInterface();
        
        console.log('Auth error handled, login modal shown');
        
        // Dispatch auth initialized event with failure
        this.dispatchAuthEvent('auth-initialized', { authenticated: false });
    }

    // Get initialization status
    isInitialized() {
        return this.initializationComplete;
    }

    // Dispatch authentication events
    dispatchAuthEvent(eventName, data) {
        if (window.eventBus) {
            window.eventBus.dispatchEvent(new CustomEvent(eventName, {
                detail: data
            }));
        }
    }

    // Enhanced UI update method - always force login state if user exists
    updateUI() {
        console.log('🔄 Updating UI - isLoggedIn:', this.isLoggedIn, 'user:', this.currentUser?.email);
        
        if (this.currentUser && localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN)) {
            // If we have user and token, force login state regardless of isLoggedIn flag
            this.isLoggedIn = true;
            this.forceLoginState();
        } else {
            // Only show logout state if no user data exists
            document.body.classList.remove('logged-in');
            document.body.classList.add('logged-out');
            this.showLoginModal();
        }
    }
}

// Auth Event Handlers
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auth manager
    window.authManager = new AuthManager();

    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            if (!email || !password) {
                Utils.showNotification('이메일과 비밀번호를 입력해주세요.', 'error');
                return;
            }

            await window.authManager.login(email, password);
        });
    }

    // Register form handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (!name || !email || !password || !confirmPassword) {
                Utils.showNotification('모든 필드를 입력해주세요.', 'error');
                return;
            }

            if (password !== confirmPassword) {
                Utils.showNotification(CONFIG.ERROR_MESSAGES.PASSWORD_MISMATCH, 'error');
                return;
            }

            if (password.length < 6) {
                Utils.showNotification('비밀번호는 최소 6자 이상이어야 합니다.', 'error');
                return;
            }

            await window.authManager.register(name, email, password);
        });
    }

    // Modal close handlers
    const loginModalClose = document.getElementById('loginModalClose');
    if (loginModalClose) {
        loginModalClose.addEventListener('click', () => {
            // Don't allow closing login modal if not authenticated
            if (!window.authManager.isAuthenticated()) {
                Utils.showNotification('로그인이 필요합니다.', 'error');
                return;
            }
            window.authManager.hideLoginModal();
        });
    }

    const registerModalClose = document.getElementById('registerModalClose');
    if (registerModalClose) {
        registerModalClose.addEventListener('click', () => {
            window.authManager.hideRegisterModal();
        });
    }

    // Switch between login and register
    const showRegister = document.getElementById('showRegister');
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            window.authManager.hideLoginModal();
            window.authManager.showRegisterModal();
        });
    }

    const showLogin = document.getElementById('showLogin');
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            window.authManager.hideRegisterModal();
            window.authManager.showLoginModal();
        });
    }

    // Logout handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await window.authManager.logout();
        });
    }

    // User avatar click handler
    const userAvatar = document.getElementById('userAvatar');
    const userDropdown = document.getElementById('userDropdown');
    
    if (userAvatar && userDropdown) {
        userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userAvatar.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        });
    }

    // Close modals when clicking outside
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');

    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                // Don't allow closing login modal if not authenticated
                if (!window.authManager.isAuthenticated()) {
                    Utils.showNotification('로그인이 필요합니다.', 'error');
                    return;
                }
                window.authManager.hideLoginModal();
            }
        });
    }

    if (registerModal) {
        registerModal.addEventListener('click', (e) => {
            if (e.target === registerModal) {
                window.authManager.hideRegisterModal();
            }
        });
    }

    // Handle Enter key in forms
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    
    if (loginEmail && loginPassword) {
        [loginEmail, loginPassword].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    loginForm.dispatchEvent(new Event('submit'));
                }
            });
        });
    }

    const registerInputs = ['registerName', 'registerEmail', 'registerPassword', 'confirmPassword'];
    registerInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    registerForm.dispatchEvent(new Event('submit'));
                }
            });
        }
    });

    // Email validation
    const emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
        input.addEventListener('blur', () => {
            const email = input.value;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (email && !emailRegex.test(email)) {
                Utils.showNotification('올바른 이메일 주소를 입력해주세요.', 'error');
                input.focus();
            }
        });
    });

    // Password strength indicator
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
        input.addEventListener('input', () => {
            const password = input.value;
            let strength = 0;
            
            if (password.length >= 6) strength++;
            if (password.match(/[a-z]/)) strength++;
            if (password.match(/[A-Z]/)) strength++;
            if (password.match(/[0-9]/)) strength++;
            if (password.match(/[^a-zA-Z0-9]/)) strength++;
            
            // Visual feedback could be added here
            input.setAttribute('data-strength', strength);
        });
    });
});

// Export AuthManager
window.AuthManager = AuthManager; 