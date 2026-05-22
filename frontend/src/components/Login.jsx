import { useState } from 'react';
import axios from 'axios';
import { Mail, Lock, Box, Loader2 } from 'lucide-react';
import { API_URL } from '../config/constants';
import './Login.css';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [shake, setShake] = useState(false);

    axios.defaults.withCredentials = true;

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setShake(false);

        try {
            const res = await axios.post(`${API_URL}/api/auth/login`, { username, password });
            localStorage.setItem('user', JSON.stringify(res.data));
            window.location.href = '/tasks'; // Fast redirect
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
            setShake(true); // Trigger shake animation
            setTimeout(() => setShake(false), 400); // Reset shake class after animation
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className={`login-card ${shake ? 'shake' : ''}`}>
                <div className="login-header">
                    <div className="logo-icon-wrapper-large">
                        <Box size={24} strokeWidth={2.5} />
                    </div>
                    <h2>GTS Portal Login</h2>
                    <p>Enter your credentials to continue</p>
                </div>
                
                <form onSubmit={handleLogin} className="login-form">
                    <div className="input-group">
                        <input 
                            type="email" 
                            placeholder="Email address" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required 
                        />
                        <Mail className="input-icon" size={18} />
                    </div>
                    
                    <div className="input-group">
                        <input 
                            type="password" 
                            placeholder="Password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required 
                        />
                        <Lock className="input-icon" size={18} />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? <Loader2 size={18} className="spinning" /> : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}