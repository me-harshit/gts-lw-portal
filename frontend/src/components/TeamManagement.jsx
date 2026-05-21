import { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Plus, GripVertical, Loader2, Search } from 'lucide-react';
import './TeamManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function TeamManagement() {
    const [producers, setProducers] = useState([]);
    const [teams, setTeams] = useState(['Unassigned']);
    const [newTeamName, setNewTeamName] = useState('');
    const [searchQuery, setSearchQuery] = useState(''); 
    const [loading, setLoading] = useState(true);
    const [draggedOverTeam, setDraggedOverTeam] = useState(null);

    // Fetch data on mount
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const prodRes = await axios.get(`${API_URL}/api/teams/producers`);
            const rawProducers = prodRes.data;

            const mapRes = await axios.get(`${API_URL}/api/teams`);
            const mappings = mapRes.data;

            const uniqueTeams = new Set(['Unassigned']);
            mappings.forEach(m => uniqueTeams.add(m.teamName));
            setTeams(Array.from(uniqueTeams));

            const mergedProducers = rawProducers.map(username => {
                const mapping = mappings.find(m => m.username === username);
                return {
                    username,
                    team: mapping ? mapping.teamName : 'Unassigned'
                };
            });

            setProducers(mergedProducers);
        } catch (error) {
            console.error("Failed to load team data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTeam = (e) => {
        e.preventDefault();
        if (newTeamName.trim() && !teams.includes(newTeamName.trim())) {
            setTeams([...teams, newTeamName.trim()]);
            setNewTeamName('');
        }
    };

    // --- HTML5 Drag and Drop Handlers ---
    const handleDragStart = (e, username) => {
        e.dataTransfer.setData('username', username);
    };

    const handleDragOver = (e, teamName) => {
        e.preventDefault();
        setDraggedOverTeam(teamName);
    };

    const handleDragLeave = () => {
        setDraggedOverTeam(null);
    };

    const handleDrop = async (e, targetTeam) => {
        e.preventDefault();
        setDraggedOverTeam(null);
        
        const username = e.dataTransfer.getData('username');
        if (!username) return;

        const user = producers.find(p => p.username === username);
        if (user && user.team === targetTeam) return;

        // Optimistic UI Update
        setProducers(prev => 
            prev.map(p => p.username === username ? { ...p, team: targetTeam } : p)
        );

        // Backend API Call
        try {
            if (targetTeam === 'Unassigned') {
                await axios.delete(`${API_URL}/api/teams/${username}`);
            } else {
                await axios.post(`${API_URL}/api/teams/assign`, {
                    username,
                    teamName: targetTeam
                });
            }
        } catch (error) {
            console.error("Failed to update team", error);
            fetchData(); 
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 className="spinning" /></div>;

    // --- Filter logic for the search bar ---
    const filteredProducers = producers.filter(p => 
        p.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="dashboard-card">
            <h2 className="dashboard-header" style={{ marginBottom: '24px' }}>Team Management</h2>

            {/* Top Controls Row (Search & Create Team) */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                
                {/* Search Bar */}
                <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                        type="text" 
                        placeholder="Search producers by username..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="team-search-input"
                    />
                </div>

                {/* Create New Team */}
                <form onSubmit={handleAddTeam} className="new-team-form">
                    <input 
                        type="text" 
                        placeholder="New team (e.g., Pali Team)" 
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        className="new-team-input-field"
                    />
                    <button type="submit" className="add-team-btn" disabled={!newTeamName.trim()}>
                        <Plus size={16} /> Add Team
                    </button>
                </form>
            </div>

            {/* Kanban Board */}
            <div className="team-board">
                {teams.map(teamName => {
                    // Filter producers for this specific column using the searched list
                    const teamProducers = filteredProducers.filter(p => p.team === teamName);

                    return (
                        <div key={teamName} className="team-column">
                            <div className="team-column-header">
                                <span>{teamName}</span>
                                <span className="team-badge">{teamProducers.length}</span>
                            </div>

                            {/* Drop Zone */}
                            <div 
                                className={`team-dropzone ${draggedOverTeam === teamName ? 'drag-over' : ''}`}
                                onDragOver={(e) => handleDragOver(e, teamName)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, teamName)}
                            >
                                {teamProducers.map(producer => (
                                    <div 
                                        key={producer.username} 
                                        className="producer-card"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, producer.username)}
                                    >
                                        <GripVertical size={16} color="var(--text-muted)" style={{ cursor: 'grab' }} />
                                        <User size={16} color="var(--primary)" />
                                        <span style={{ fontSize: '14px', fontWeight: '500' }}>
                                            {producer.username}
                                        </span>
                                    </div>
                                ))}
                                
                                {teamProducers.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        {searchQuery ? 'No matching producers found' : 'Drag producers here'}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}