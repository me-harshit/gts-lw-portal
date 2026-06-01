import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, Users, Plus, GripVertical, Loader2, Search, CheckSquare, MapPin, Clock, ShieldCheck, Tag as TagIcon, ChevronDown, Filter, MoveRight } from 'lucide-react';
import './TeamManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SHIFTS = [
    "Morning (7 AM - 3 PM)",
    "Regular (9 AM - 6 PM)",
    "Evening (3 PM - 11 PM)",
    "Night (9 PM - 5 AM)",
    "Night (11 PM - 7 AM)"
];

// --- CUSTOM DROPDOWN COMPONENT ---
const CustomSelect = ({ value, onChange, options, icon: Icon, placeholder, containerStyle }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <div className="custom-dropdown-container" style={containerStyle || { width: 'auto', minWidth: '160px' }} ref={dropdownRef}>
            <div className="custom-dropdown-header" onClick={() => setIsOpen(!isOpen)} style={{ height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Icon && <Icon size={16} color="var(--text-muted)" />}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedLabel}</span>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />
            </div>
            {isOpen && (
                <div className="custom-dropdown-menu">
                    <ul className="custom-dropdown-list">
                        {options.map(opt => (
                            <li 
                                key={opt.value} 
                                className={`custom-dropdown-item ${value === opt.value ? 'active' : ''}`}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            >
                                {opt.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default function TeamManagement() {
    const [loading, setLoading] = useState(true);
    
    // Core Data
    const [tags, setTags] = useState([]);
    const [teams, setTeams] = useState([]);
    const [producers, setProducers] = useState([]);
    
    // Filters & Selections
    const [activeTag, setActiveTag] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    const [bulkTargetTeam, setBulkTargetTeam] = useState('');

    // Forms
    const [newTagName, setNewTagName] = useState('');
    const [newTeam, setNewTeam] = useState({ name: '', tag: '', location: '', timingSlot: '', supervisor: '' });

    // Drag Drop
    const [draggedOverTeam, setDraggedOverTeam] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [tagsRes, teamsRes, prodRes, mapRes] = await Promise.all([
                axios.get(`${API_URL}/api/teams/tags`),
                axios.get(`${API_URL}/api/teams/configs`),
                axios.get(`${API_URL}/api/teams/producers`),
                axios.get(`${API_URL}/api/teams`)
            ]);

            const fetchedTags = tagsRes.data.map(t => t.name);
            const fetchedConfigs = teamsRes.data;
            const mappings = mapRes.data;
            const rawProducers = prodRes.data;

            // 1. GATHER ALL UNIQUE TEAMS (including old ones without configs)
            const allTeamNames = new Set(fetchedConfigs.map(c => c.name));
            mappings.forEach(m => {
                if (m.teamName && m.teamName !== 'Unassigned') {
                    allTeamNames.add(m.teamName);
                }
            });

            // 2. RECONSTRUCT TEAMS (Give old teams a "Legacy" tag so they don't disappear)
            const combinedTeams = Array.from(allTeamNames).map(name => {
                const existingConfig = fetchedConfigs.find(c => c.name === name);
                if (existingConfig) return existingConfig;
                return { name, tag: 'Legacy Teams', location: 'N/A', timingSlot: 'N/A', supervisor: 'N/A' };
            });

            setTeams(combinedTeams);

            // 3. ADD 'Legacy Teams' TO TAGS IF NEEDED
            const hasLegacy = combinedTeams.some(t => t.tag === 'Legacy Teams');
            const displayTags = [...fetchedTags];
            if (hasLegacy && !displayTags.includes('Legacy Teams')) {
                displayTags.push('Legacy Teams');
            }
            setTags(displayTags.map(t => ({ name: t })));

            // 4. MAP PRODUCERS
            const mergedProducers = rawProducers.map(username => {
                const mapping = mappings.find(m => m.username === username);
                return { username, team: mapping ? mapping.teamName : 'Unassigned' };
            });

            setProducers(mergedProducers);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    // --- FORM HANDLERS ---
    const handleAddTag = async (e) => {
        e.preventDefault();
        if (!newTagName.trim()) return;
        try {
            await axios.post(`${API_URL}/api/teams/tags`, { name: newTagName.trim() });
            setNewTagName('');
            fetchData();
        } catch (error) { console.error("Add tag failed", error); }
    };

    const handleAddTeam = async (e) => {
        e.preventDefault();
        if (!newTeam.name || !newTeam.tag || !newTeam.location || !newTeam.timingSlot || !newTeam.supervisor) return alert("All fields required");
        try {
            await axios.post(`${API_URL}/api/teams/configs`, newTeam);
            setNewTeam({ name: '', tag: '', location: '', timingSlot: '', supervisor: '' });
            fetchData();
        } catch (error) { console.error("Add team failed", error); }
    };

    // --- BATCH MOVE ---
    const toggleUserSelection = (username) => {
        const newSet = new Set(selectedUsers);
        if (newSet.has(username)) newSet.delete(username);
        else newSet.add(username);
        setSelectedUsers(newSet);
    };

    const handleBulkMove = async () => {
        if (selectedUsers.size === 0 || !bulkTargetTeam) return;
        try {
            await axios.post(`${API_URL}/api/teams/assign-batch`, {
                usernames: Array.from(selectedUsers),
                teamName: bulkTargetTeam
            });
            setSelectedUsers(new Set());
            setBulkTargetTeam('');
            fetchData();
        } catch (error) { console.error("Batch move failed", error); }
    };

    // --- DRAG AND DROP ---
    const handleDragStart = (e, username) => { e.dataTransfer.setData('username', username); };
    const handleDragOver = (e, teamName) => { e.preventDefault(); setDraggedOverTeam(teamName); };
    const handleDragLeave = () => setDraggedOverTeam(null);
    const handleDrop = async (e, targetTeam) => {
        e.preventDefault();
        setDraggedOverTeam(null);
        const username = e.dataTransfer.getData('username');
        if (!username) return;

        setProducers(prev => prev.map(p => p.username === username ? { ...p, team: targetTeam } : p));
        try {
            if (targetTeam === 'Unassigned') await axios.delete(`${API_URL}/api/teams/${username}`);
            else await axios.post(`${API_URL}/api/teams/assign`, { username, teamName: targetTeam });
        } catch (error) { fetchData(); }
    };

    // --- FILTER LOGIC ---
    const visibleTeams = activeTag === 'ALL' ? teams : teams.filter(t => t.tag === activeTag);
    const columnsToRender = [...visibleTeams.map(t => t.name), 'Unassigned'];
    const filteredProducers = producers.filter(p => p.username.toLowerCase().includes(searchQuery.toLowerCase()));

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 className="spinning" /></div>;

    return (
        <div className="dashboard-card" style={{ maxWidth: '1600px', margin: '0 auto' }}>
            <h2 className="dashboard-header" style={{ marginBottom: '24px' }}>Hierarchical Team Management</h2>

            {/* --- CREATION FORMS --- */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '32px', background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                
                {/* Create Tag */}
                <form onSubmit={handleAddTag} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}><TagIcon size={16}/> Create Parent Tag</div>
                    <div style={{ display: 'flex', gap: '8px', height: '40px' }}>
                        <input type="text" placeholder="e.g. GTS Inhouse" value={newTagName} onChange={e => setNewTagName(e.target.value)} className="tm-input" />
                        <button type="submit" className="add-team-btn" disabled={!newTagName.trim()}><Plus size={16}/></button>
                    </div>
                </form>

                {/* Create Team */}
                <form onSubmit={handleAddTeam} style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '20px', borderLeft: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16}/> Create Sub-Team</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        
                        <CustomSelect 
                            value={newTeam.tag} 
                            onChange={val => setNewTeam({...newTeam, tag: val})} 
                            options={[{ value: '', label: 'Select Parent Tag...' }, ...tags.map(t => ({ value: t.name, label: t.name }))]}
                            containerStyle={{ width: '100%', height: '40px' }}
                        />

                        <input type="text" placeholder="Team Name (e.g. Morning Squad)" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} className="tm-input" />
                        
                        <input type="text" placeholder="Location (e.g. Lucknow)" value={newTeam.location} onChange={e => setNewTeam({...newTeam, location: e.target.value})} className="tm-input" />
                        
                        <CustomSelect 
                            value={newTeam.timingSlot} 
                            onChange={val => setNewTeam({...newTeam, timingSlot: val})} 
                            options={[{ value: '', label: 'Select Shift...' }, ...SHIFTS.map(s => ({ value: s, label: s }))]}
                            containerStyle={{ width: '100%', height: '40px' }}
                        />

                        <input type="text" placeholder="Supervisor Name" value={newTeam.supervisor} onChange={e => setNewTeam({...newTeam, supervisor: e.target.value})} className="tm-input" style={{ gridColumn: '1 / -1' }} />
                    </div>
                    <button type="submit" className="add-team-btn" style={{ alignSelf: 'flex-end', padding: '8px 24px' }}>Create Team</button>
                </form>
            </div>

            {/* --- FILTER & BULK ACTION BAR --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    
                    <CustomSelect 
                        icon={Filter}
                        value={activeTag} 
                        onChange={(val) => setActiveTag(val)} 
                        options={[{ value: 'ALL', label: 'All Tags (Global View)' }, ...tags.map(t => ({ value: t.name, label: `Tag: ${t.name}` }))]}
                        containerStyle={{ width: '220px', height: '40px' }}
                    />
                    
                    <div style={{ position: 'relative', width: '250px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Search producers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="tm-input" style={{ paddingLeft: '36px', height: '40px' }} />
                    </div>
                </div>

                {selectedUsers.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(59, 130, 246, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                        <span style={{ fontWeight: '600', color: 'var(--primary)', fontSize: '13px' }}>{selectedUsers.size} Selected</span>
                        
                        <CustomSelect 
                            icon={MoveRight}
                            value={bulkTargetTeam} 
                            onChange={setBulkTargetTeam} 
                            options={[{ value: '', label: 'Move to Team...' }, { value: 'Unassigned', label: 'Unassigned' }, ...teams.map(t => ({ value: t.name, label: t.name }))]}
                            containerStyle={{ width: '200px', height: '36px' }}
                        />
                        
                        <button onClick={handleBulkMove} disabled={!bulkTargetTeam} className="add-team-btn" style={{ height: '36px' }}>Apply Move</button>
                    </div>
                )}
            </div>

            {/* --- KANBAN BOARD --- */}
            <div className="team-board">
                {columnsToRender.map(teamName => {
                    const teamProducers = filteredProducers.filter(p => p.team === teamName);
                    const teamConfig = teams.find(t => t.name === teamName);

                    return (
                        <div key={teamName} className="team-column">
                            <div className="team-column-header">
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-main)' }}>{teamName}</span>
                                    {teamConfig && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={10}/> {teamConfig.location}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10}/> {teamConfig.timingSlot}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}><ShieldCheck size={10}/> {teamConfig.supervisor}</span>
                                        </div>
                                    )}
                                </div>
                                <span className="team-badge">{teamProducers.length}</span>
                            </div>

                            <div 
                                className={`team-dropzone ${draggedOverTeam === teamName ? 'drag-over' : ''}`}
                                onDragOver={(e) => handleDragOver(e, teamName)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, teamName)}
                            >
                                {teamProducers.map(producer => (
                                    <div 
                                        key={producer.username} 
                                        className={`producer-card ${selectedUsers.has(producer.username) ? 'selected' : ''}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, producer.username)}
                                        onClick={() => toggleUserSelection(producer.username)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <CheckSquare 
                                                size={16} 
                                                color={selectedUsers.has(producer.username) ? "var(--primary)" : "var(--text-muted)"} 
                                            />
                                            <User size={16} color="var(--primary)" />
                                            <span style={{ fontSize: '14px', fontWeight: '500' }}>
                                                {producer.username}
                                            </span>
                                        </div>
                                        <GripVertical size={16} color="var(--text-muted)" style={{ cursor: 'grab' }} />
                                    </div>
                                ))}
                                
                                {teamProducers.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        Empty Team
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