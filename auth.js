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
        console.log('=== Starting Auth Initialization ===');
        
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        const user = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

        console.log('Auth check - Token exists:', !!token, 'User exists:', !!user);

        if (token && user) {
            try {
                // Parse user data
                this.currentUser = JSON.parse(user);
                this.isLoggedIn = true;
                
                console.log('✓ Auth data found, setting logged in state for:', this.currentUser.email);
                
                // Update UI immediately with force flag
                this.updateUI(true);
                
                // Hide login modal immediately
                this.hideLoginModal();
                
                // Enable interface immediately
                this.enableInterface();
                
                // Show main content immediately
                this.showMainContent();
                
                console.log('✓ UI updated, loading user data...');
                
                // Load user data in background
                await this.loadUserData();
                
                // Validate token silently (non-blocking)
                this.validateTokenSilently();
                
                this.initializationComplete = true;
                console.log('✓ Auth initialization complete');
                
            } catch (error) {
                console.error('❌ Auth initialization error:', error);
                this.handleAuthError();
            }
        } else {
            console.log('❌ No valid auth data found, showing login');
            this.handleAuthError();
        }
    }

    // Handle authentication errors
    handleAuthError() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.initializationComplete = true;
        
        // Clear any invalid data
        localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
        
        // Update UI
        this.updateUI(true);
        this.showLoginModal();
        this.disableInterface();
        this.hideMainContent();
    }

    // Load user data and initialize app components
    async loadUserData() {
        try {
            console.log('Loading user data...');
            
            // Wait for file manager to be available
            await this.waitForFileManager();
            
            // Initialize file manager
            if (window.fileManager) {
                console.log('✓ File manager available, loading files...');
                await window.fileManager.loadFiles();
                await window.fileManager.loadStorageInfo();
                console.log('✓ Files loaded successfully');
            }
            
            console.log('✓ User data loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load user data:', error);
            // Don't logout immediately for network errors
            if (error.status === 401 || error.status === 403) {
                this.handleAuthError();
            }
        }
    }

    // Wait for file manager to be available
    async waitForFileManager(maxWait = 10000) {
        const startTime = Date.now();
        
        while (!window.fileManager && (Date.now() - startTime) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!window.fileManager) {
            console.warn('⚠️ File manager not available after waiting');
        }
        
        return window.fileManager;
    }

    // Validate token silently in background
    async validateTokenSilently() {
        try {
            console.log('Validating token silently...');
            
            const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.auth.profile);
            
            if (response && response.user) {
                // Update user info if needed
                this.currentUser = response.user;
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(this.currentUser));
                this.updateUI();
                console.log('✓ Token validation successful');
            }
            
        } catch (error) {
            console.warn('⚠️ Token validation failed:', error);
            
            // Only logout if it's a clear auth error (401, 403)
            if (error.status === 401 || error.status === 403) {
                console.log('❌ Token expired or invalid, logging out');
                this.handleAuthError();
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
            this.handleAuthError();
        }
    }

    // Login user
    async login(email, password) {
        try {
            Utils.showLoading(true);

            const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.auth.login, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            // Store user data
            localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, response.token);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.user));

            this.currentUser = response.user;
            this.isLoggedIn = true;
            this.initializationComplete = true;

            // Update UI
            this.updateUI(true);
            this.hideLoginModal();
            this.enableInterface();
            this.showMainContent();

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
            this.initializationComplete = true;

            // Update UI
            this.updateUI(true);
            this.hideRegisterModal();
            this.enableInterface();
            this.showMainContent();

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
            this.handleAuthError();
            Utils.showNotification(CONFIG.SUCCESS_MESSAGES.LOGOUT_SUCCESS);
        }
    }

    // Update UI based on authentication state
    updateUI(force = false) {
        // Skip UI updates if initialization is not complete (unless forced)
        if (!this.initializationComplete && !force) {
            console.log('Skipping UI update - initialization not complete');
            return;
        }
        
        console.log('=== Updating UI ===');
        console.log('Auth state - isLoggedIn:', this.isLoggedIn, 'currentUser:', this.currentUser?.email);
        
        if (this.isLoggedIn && this.currentUser) {
            console.log('✓ Showing authenticated UI');
            this.showAuthenticatedUI();
        } else {
            console.log('✓ Showing login UI');
            this.showLoginUI();
        }
    }

    // Show authenticated UI
    showAuthenticatedUI() {
        // Hide auth modals
        this.hideAllModals();
        
        // Show main content
        this.showMainContent();
        
        // Update user info
        this.updateUserInfo();
        
        // Enable interface
        this.enableInterface();
        
        console.log('✓ Authenticated UI shown');
    }

    // Show login UI
    showLoginUI() {
        // Hide main content
        this.hideMainContent();
        
        // Show login modal
        this.showLoginModal();
        
        // Disable interface
        this.disableInterface();
        
        console.log('✓ Login UI shown');
    }

    // Hide all modals
    hideAllModals() {
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        
        if (loginModal) {
            loginModal.style.display = 'none';
            loginModal.classList.remove('active');
        }
        if (registerModal) {
            registerModal.style.display = 'none';
            registerModal.classList.remove('active');
        }
    }

    // Show main content
    showMainContent() {
        const mainContent = document.querySelector('.main-content');
        const body = document.body;
        
        if (mainContent) {
            mainContent.style.display = 'flex';
            mainContent.style.visibility = 'visible';
            mainContent.style.opacity = '1';
        }
        
        if (body) {
            body.classList.add('logged-in');
            body.classList.remove('logged-out');
        }
        
        console.log('✓ Main content shown');
    }

    // Hide main content
    hideMainContent() {
        const mainContent = document.querySelector('.main-content');
        const body = document.body;
        
        if (mainContent) {
            mainContent.style.display = 'none';
            mainContent.style.visibility = 'hidden';
            mainContent.style.opacity = '0';
        }
        
        if (body) {
            body.classList.add('logged-out');
            body.classList.remove('logged-in');
        }
        
        console.log('✓ Main content hidden');
    }

    // Update user info in UI
    updateUserInfo() {
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.getElementById('userAvatar');
        
        if (this.currentUser) {
            if (userName) userName.textContent = this.currentUser.name || this.currentUser.email;
            if (userEmail) userEmail.textContent = this.currentUser.email;
            if (userAvatar) {
                userAvatar.innerHTML = `<i class="fas fa-user"></i>`;
                userAvatar.title = this.currentUser.name || this.currentUser.email;
            }
        }
        
        console.log('✓ User info updated');
    }

    // Enable interface elements
    enableInterface() {
        const buttons = document.querySelectorAll('button:not(.modal-close)');
        const inputs = document.querySelectorAll('input:not([id*="login"]):not([id*="register"])');
        const navItems = document.querySelectorAll('.nav-item');
        
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
        
        inputs.forEach(input => {
            input.disabled = false;
            input.style.opacity = '1';
            input.style.pointerEvents = 'auto';
        });
        
        navItems.forEach(item => {
            item.style.pointerEvents = 'auto';
            item.style.opacity = '1';
        });
        
        console.log('✓ Interface enabled');
    }

    // Disable interface elements
    disableInterface() {
        const buttons = document.querySelectorAll('button:not(.modal-close):not([id*="login"]):not([id*="register"])');
        const inputs = document.querySelectorAll('input:not([id*="login"]):not([id*="register"])');
        const navItems = document.querySelectorAll('.nav-item');
        
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        });
        
        inputs.forEach(input => {
            input.disabled = true;
            input.style.opacity = '0.5';
            input.style.pointerEvents = 'none';
        });
        
        navItems.forEach(item => {
            item.style.pointerEvents = 'none';
            item.style.opacity = '0.5';
        });
        
        console.log('✓ Interface disabled');
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

    // Load initial data after login
    async loadInitialData() {
        try {
            // Wait for file manager to be available
            await this.waitForFileManager();
            
            // Only load if fileManager is available
            if (window.fileManager) {
                await Promise.all([
                    window.fileManager.loadFiles(),
                    window.fileManager.loadStorageInfo()
                ]);
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
        return this.isLoggedIn && this.currentUser && this.initializationComplete;
    }

    // Get initialization status
    isInitialized() {
        return this.initializationComplete;
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