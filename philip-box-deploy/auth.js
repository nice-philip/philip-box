// Authentication Manager
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.initializeAuth();
    }

    // Initialize authentication
    async initializeAuth() {
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        const user = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

        if (token && user) {
            try {
                this.currentUser = JSON.parse(user);
                this.isLoggedIn = true;
                this.updateUI();
                await this.validateToken();
            } catch (error) {
                console.error('Token validation failed:', error);
                this.logout();
            }
        } else {
            this.showLoginModal();
        }
    }

    // Validate token with server
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

            const response = await Utils.apiRequest(CONFIG.API_ENDPOINTS.auth.login, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            // Store user data
            localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, response.token);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.user));

            this.currentUser = response.user;
            this.isLoggedIn = true;

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

    // Update UI based on authentication state
    updateUI() {
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');

        if (this.isLoggedIn && this.currentUser) {
            userName.textContent = this.currentUser.name || '사용자';
            userEmail.textContent = this.currentUser.email || '';
        } else {
            userName.textContent = '사용자';
            userEmail.textContent = '';
        }
    }

    // Show login modal
    showLoginModal() {
        const loginModal = document.getElementById('loginModal');
        loginModal.classList.add('active');
    }

    // Hide login modal
    hideLoginModal() {
        const loginModal = document.getElementById('loginModal');
        loginModal.classList.remove('active');
    }

    // Show register modal
    showRegisterModal() {
        const registerModal = document.getElementById('registerModal');
        registerModal.classList.add('active');
    }

    // Hide register modal
    hideRegisterModal() {
        const registerModal = document.getElementById('registerModal');
        registerModal.classList.remove('active');
    }

    // Load initial data after login
    async loadInitialData() {
        try {
            // Load files and storage info
            await Promise.all([
                window.fileManager.loadFiles(),
                window.fileManager.loadStorageInfo()
            ]);
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