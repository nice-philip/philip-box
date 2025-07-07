const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

// 로컬 개발을 위한 임시 사용자 데이터
const TEMP_USERS = [
    {
        email: 'test@example.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        name: 'Test User',
        _id: '507f1f77bcf86cd799439011'
    },
    {
        email: 'admin@example.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        name: 'Admin User',
        _id: '507f1f77bcf86cd799439012'
    }
];

// MongoDB 연결 상태 확인
function isMongoConnected() {
    return mongoose.connection.readyState === 1;
}

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!isMongoConnected()) {
            return res.status(503).json({
                message: 'Database unavailable - Registration disabled in development mode'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: 'User already exists with this email'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: process.env.JWT_EXPRIES_IN || '7d' }
        );

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            message: 'Registration failed',
            error: error.message
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        let user = null;

        if (isMongoConnected()) {
            // MongoDB is connected - use database
            user = await User.findOne({ email });
            
            if (user) {
                // Check password
                const isPasswordValid = await bcrypt.compare(password, user.password);
                if (!isPasswordValid) {
                    return res.status(401).json({
                        message: 'Invalid email or password'
                    });
                }
            }
        } else {
            // MongoDB not connected - use temporary users
            console.log('🔧 Using temporary user data for login');
            user = TEMP_USERS.find(u => u.email === email);
            
            if (user) {
                // Check password
                const isPasswordValid = await bcrypt.compare(password, user.password);
                if (!isPasswordValid) {
                    return res.status(401).json({
                        message: 'Invalid email or password'
                    });
                }
            }
        }

        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: process.env.JWT_EXPRIES_IN || '7d' }
        );

        // Remove password from response
        const userResponse = { ...user };
        delete userResponse.password;

        res.json({
            message: 'Login successful',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Login failed',
            error: error.message
        });
    }
});

// Logout user
router.post('/logout', auth, async (req, res) => {
    try {
        res.json({
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            message: 'Logout failed',
            error: error.message
        });
    }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        let user = null;

        if (isMongoConnected()) {
            user = await User.findById(req.user.userId);
        } else {
            user = TEMP_USERS.find(u => u._id === req.user.userId);
        }

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Remove password from response
        const userResponse = { ...user };
        delete userResponse.password;

        res.json({
            user: userResponse
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            message: 'Failed to get profile',
            error: error.message
        });
    }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, preferences } = req.body;
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Update allowed fields
        if (name) user.name = name;
        if (preferences) user.preferences = { ...user.preferences, ...preferences };

        await user.save();

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            message: 'Profile updated successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            message: 'Failed to update profile',
            error: error.message
        });
    }
});

// Change password
router.put('/password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.userId).select('+password');
        
        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(401).json({
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            message: 'Failed to change password',
            error: error.message
        });
    }
});

module.exports = router; 