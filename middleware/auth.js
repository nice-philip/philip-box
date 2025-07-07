const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                message: 'No token provided, authorization denied'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from token
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                message: 'Token is not valid'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                message: 'User account is inactive'
            });
        }

        // Add user to request object
        req.user = {
            userId: user._id,
            email: user.email,
            name: user.name,
            role: user.role
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                message: 'Token is not valid'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                message: 'Token has expired'
            });
        }
        
        res.status(500).json({
            message: 'Server error in authentication'
        });
    }
};

module.exports = auth; 