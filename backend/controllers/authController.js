import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Find user
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: "Invalid credentials" });

        // 2. Check password against the hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        // 3. Generate JWT Token
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 4. Set HTTP-Only Cookie
        res.cookie('token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // 5. Send user data back (EXCEPT password)
        // Ensure your React Login component saves this to localStorage!
        res.status(200).json({ username: user.username, role: user.role });

    } catch (error) {
        res.status(500).json({ message: "Server error during login" });
    }
};

export const logout = (req, res) => {
    // Clear the cookie to log out
    res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
    res.status(200).json({ message: "Logged out successfully" });
};