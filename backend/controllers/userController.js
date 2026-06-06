import User from '../models/User.js';
import bcrypt from 'bcrypt'; // Standard for hashing passwords

export const getUsers = async (req, res) => {
    try {
        // Fetch all users, but exclude the password field for security
        const users = await User.find({}, '-password').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const createUser = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: 'Username already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ 
            username, 
            password: hashedPassword, 
            role: role || 'USER' 
        });
        await newUser.save();

        res.status(201).json({ 
            _id: newUser._id, 
            username: newUser.username, 
            role: newUser.role 
        });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

export const updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        const updatedUser = await User.findByIdAndUpdate(
            id, 
            { role }, 
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!updatedUser) return res.status(404).json({ error: 'User not found' });
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error updating role:", error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
};

export const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        await User.findByIdAndDelete(id);
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};