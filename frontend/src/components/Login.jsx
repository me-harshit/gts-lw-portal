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
            // withCredentials is required for httpOnly cookies to save in the browser
            const res = await axios.post(`${API_URL}/api/auth/login`,
                { username, password },
                { withCredentials: true }
            );

            // FIX 1: Save the user info
            localStorage.setItem('user', JSON.stringify(res.data));

            // FIX 2: Save the 'token' key so ProtectedRoute knows you are logged in
            localStorage.setItem('token', 'true');

            window.location.href = '/tasks';
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed.');
            setShake(true);
            setTimeout(() => setShake(false), 400);
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