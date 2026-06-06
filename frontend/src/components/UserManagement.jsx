import { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Shield, Trash2, Loader2, User as UserIcon } from 'lucide-react';
import './UserManagement.css'; // Import the new CSS file

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function UserManagement() {
    const queryClient = useQueryClient();
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'USER' });

    // --- FETCH USERS ---
    const { data: users = [], isFetching } = useQuery({
        queryKey: ['adminUsers'],
        queryFn: async () => {
            const res = await axios.get(`${API_URL}/api/users`);
            return res.data;
        },
        refetchOnWindowFocus: false
    });

    // --- MUTATIONS ---
    const createUserMutation = useMutation({
        mutationFn: (userData) => axios.post(`${API_URL}/api/users`, userData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
            setIsAddingUser(false);
            setNewUser({ username: '', password: '', role: 'USER' });
        },
        onError: (error) => alert(error.response?.data?.error || 'Failed to create user')
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }) => axios.put(`${API_URL}/api/users/${id}/role`, { role }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
        onError: () => alert('Failed to update role')
    });

    const deleteUserMutation = useMutation({
        mutationFn: (id) => axios.delete(`${API_URL}/api/users/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
        onError: () => alert('Failed to delete user')
    });

    // --- HANDLERS ---
    const handleAddUser = (e) => {
        e.preventDefault();
        if (!newUser.username || !newUser.password) return alert('Username and Password are required');
        createUserMutation.mutate(newUser);
    };

    const getRoleBadgeClass = (role) => {
        if (role === 'ADMIN') return 'badge-admin';
        if (role === 'CORE_TEAM') return 'badge-core';
        return 'badge-user';
    };

    return (
        <div className="dashboard-card um-container">
            
            {/* HEADER SECTION */}
            <div className="um-header-section">
                <div className="um-header-text">
                    <h2 className="dashboard-header um-title">
                        <Shield size={28} /> System Access Management
                    </h2>
                    <p className="um-subtitle">
                        Manage user roles and permissions. Changes take effect immediately.
                    </p>
                </div>
                <button 
                    className={`um-btn ${isAddingUser ? 'um-btn-cancel' : 'um-btn-primary'}`}
                    onClick={() => setIsAddingUser(!isAddingUser)}
                >
                    {isAddingUser ? 'Cancel' : <><UserPlus size={18} /> Add New User</>}
                </button>
            </div>

            {/* ADD USER FORM */}
            {isAddingUser && (
                <form className="um-add-form" onSubmit={handleAddUser}>
                    <div className="um-form-group">
                        <label>USERNAME</label>
                        <input 
                            type="text" 
                            className="um-input" 
                            value={newUser.username} 
                            onChange={(e) => setNewUser({...newUser, username: e.target.value})} 
                            placeholder="Enter username" 
                        />
                    </div>
                    <div className="um-form-group">
                        <label>PASSWORD</label>
                        <input 
                            type="password" 
                            className="um-input" 
                            value={newUser.password} 
                            onChange={(e) => setNewUser({...newUser, password: e.target.value})} 
                            placeholder="Enter temporary password" 
                        />
                    </div>
                    <div className="um-form-group">
                        <label>ROLE</label>
                        <select 
                            className="um-select" 
                            value={newUser.role} 
                            onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                        >
                            <option value="USER">Normal User</option>
                            <option value="CORE_TEAM">Core Team</option>
                            <option value="ADMIN">Administrator</option>
                        </select>
                    </div>
                    <div className="um-form-actions">
                        <button type="submit" className="um-btn um-btn-success" disabled={createUserMutation.isPending}>
                            {createUserMutation.isPending ? <Loader2 size={18} className="spinning" /> : 'Create Account'}
                        </button>
                    </div>
                </form>
            )}

            {/* USERS TABLE */}
            <div className={`um-table-wrapper ${isFetching ? 'loading-opacity' : ''}`}>
                <table className="um-table">
                    <thead>
                        <tr>
                            <th>User Profile</th>
                            <th>Current Role</th>
                            <th>Update Permission</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isFetching && users.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="um-empty-state">
                                    <Loader2 className="spinning" size={24} />
                                </td>
                            </tr>
                        ) : users.length > 0 ? (
                            users.map((user) => (
                                <tr key={user._id}>
                                    <td>
                                        <div className="um-user-cell">
                                            <div className="um-avatar">
                                                <UserIcon size={16} />
                                            </div>
                                            <span className="um-username">{user.username}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`um-role-badge ${getRoleBadgeClass(user.role)}`}>
                                            {user.role.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td>
                                        <select 
                                            className="um-table-select"
                                            value={user.role} 
                                            onChange={(e) => updateRoleMutation.mutate({ id: user._id, role: e.target.value })}
                                            disabled={updateRoleMutation.isPending}
                                        >
                                            <option value="USER">Normal User</option>
                                            <option value="CORE_TEAM">Core Team</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                    </td>
                                    <td className="text-right">
                                        <button 
                                            className="um-btn-icon um-btn-danger"
                                            onClick={() => { if(window.confirm(`Are you sure you want to delete ${user.username}?`)) deleteUserMutation.mutate(user._id) }}
                                            disabled={deleteUserMutation.isPending}
                                            title="Delete User"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className="um-empty-state">No users found in database.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}