import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, Users, Plus, GripVertical, Loader2, Search, CheckSquare, MapPin, Clock, ShieldCheck, Tag as TagIcon, ChevronDown, Filter, MoveRight, Settings, Trash2, Edit2, X } from 'lucide-react';
import './TeamManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// --- CUSTOM DROPDOWN ---
const CustomSelect = ({ value, onChange, options, icon: Icon, placeholder, containerStyle }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;
    return (
        <div className="custom-dropdown-container" style={containerStyle || { width: 'auto', minWidth: '160px' }} ref={dropdownRef}>
            <div className="custom-dropdown-header" onClick={() => setIsOpen(!isOpen)} style={{ height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {Icon && <Icon size={16} color="var(--text-muted)" />}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedLabel}</span>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />
            </div>
            {isOpen && (
                <div className="custom-dropdown-menu">
                    <ul className="custom-dropdown-list">
                        {options.map(opt => (
                            <li key={opt.value} className={`custom-dropdown-item ${value === opt.value ? 'active' : ''}`} onClick={() => { onChange(opt.value); setIsOpen(false); }}>
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
    const [showConfig, setShowConfig] = useState(false);
    
    // Core Data
    const [tags, setTags] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [teams, setTeams] = useState([]);
    const [producers, setProducers] = useState([]);
    
    // Filters & Selections
    const [activeTag, setActiveTag] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    const [bulkTargetTeam, setBulkTargetTeam] = useState('');

    // Forms
    const [newTeam, setNewTeam] = useState({ name: '', tag: '', location: '', timingSlot: '', supervisor: '' });
    const [editTeamModal, setEditTeamModal] = useState(null);

    // Meta Forms
    const [newMeta, setNewMeta] = useState({ tag: '', shift: '', supervisor: '' });

    // Drag Drop
    const [draggedOverTeam, setDraggedOverTeam] = useState(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [tagsRes, shiftsRes, supRes, teamsRes, prodRes, mapRes] = await Promise.all([
                axios.get(`${API_URL}/api/teams/tags`),
                axios.get(`${API_URL}/api/teams/shifts`),
                axios.get(`${API_URL}/api/teams/supervisors`),
                axios.get(`${API_URL}/api/teams/configs`),
                axios.get(`${API_URL}/api/teams/producers`),
                axios.get(`${API_URL}/api/teams`)
            ]);

            setTags(tagsRes.data);
            setShifts(shiftsRes.data);
            setSupervisors(supRes.data);

            const fetchedConfigs = teamsRes.data;
            const mappings = mapRes.data;
            const rawProducers = prodRes.data;

            const allTeamNames = new Set(fetchedConfigs.map(c => c.name));
            mappings.forEach(m => { if (m.teamName && m.teamName !== 'Unassigned') allTeamNames.add(m.teamName); });

            const combinedTeams = Array.from(allTeamNames).map(name => {
                const existingConfig = fetchedConfigs.find(c => c.name === name);
                return existingConfig || { name, tag: 'Legacy Teams', location: 'N/A', timingSlot: 'N/A', supervisor: 'N/A' };
            });
            setTeams(combinedTeams);

            const mergedProducers = rawProducers.map(username => {
                const mapping = mappings.find(m => m.username === username);
                return { username, team: mapping ? mapping.teamName : 'Unassigned' };
            });
            setProducers(mergedProducers);
        } catch (error) { console.error("Failed to load data", error); } 
        finally { setLoading(false); }
    };

    // --- METADATA HANDLERS ---
    const handleAddMeta = async (type) => {
        if (!newMeta[type].trim()) return;
        try {
            await axios.post(`${API_URL}/api/teams/${type}s`, { name: newMeta[type].trim() });
            setNewMeta({ ...newMeta, [type]: '' });
            fetchData();
        } catch (error) { console.error(`Add ${type} failed`, error); }
    };

    const handleDeleteMeta = async (type, id) => {
        if (!window.confirm(`Delete this ${type}?`)) return;
        try {
            await axios.delete(`${API_URL}/api/teams/${type}s/${id}`);
            fetchData();
        } catch (error) { console.error(`Delete ${type} failed`, error); }
    };

    // --- TEAM HANDLERS ---
    const handleAddTeam = async (e) => {
        e.preventDefault();
        if (!newTeam.name || !newTeam.tag || !newTeam.location || !newTeam.timingSlot || !newTeam.supervisor) return alert("All fields required");
        try {
            await axios.post(`${API_URL}/api/teams/configs`, newTeam);
            setNewTeam({ name: '', tag: '', location: '', timingSlot: '', supervisor: '' });
            fetchData();
        } catch (error) { console.error("Add team failed", error); }
    };

    const handleUpdateTeam = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API_URL}/api/teams/configs/${editTeamModal.oldName}`, editTeamModal);
            setEditTeamModal(null);
            fetchData();
        } catch (error) { console.error("Update team failed", error); }
    };

    const handleDeleteTeam = async (teamName) => {
        if (!window.confirm(`Are you sure you want to delete ${teamName}? All producers will be moved to Unassigned.`)) return;
        try {
            await axios.delete(`${API_URL}/api/teams/configs/${teamName}`);
            fetchData();
        } catch (error) { console.error("Delete team failed", error); }
    };

    // --- BATCH MOVE ---
    const toggleUserSelection = (username) => {
        const newSet = new Set(selectedUsers);
        if (newSet.has(username)) newSet.delete(username); else newSet.add(username);
        setSelectedUsers(newSet);
    };

    const handleBulkMove = async () => {
        if (selectedUsers.size === 0 || !bulkTargetTeam) return;
        try {
            await axios.post(`${API_URL}/api/teams/assign-batch`, { usernames: Array.from(selectedUsers), teamName: bulkTargetTeam });
            setSelectedUsers(new Set()); setBulkTargetTeam(''); fetchData();
        } catch (error) { console.error("Batch move failed", error); }
    };

    // --- DRAG AND DROP ---
    const handleDragStart = (e, username) => e.dataTransfer.setData('username', username);
    const handleDragOver = (e, teamName) => { e.preventDefault(); setDraggedOverTeam(teamName); };
    const handleDragLeave = () => setDraggedOverTeam(null);
    const handleDrop = async (e, targetTeam) => {
        e.preventDefault(); setDraggedOverTeam(null);
        const username = e.dataTransfer.getData('username');
        if (!username) return;
        setProducers(prev => prev.map(p => p.username === username ? { ...p, team: targetTeam } : p));
        try {
            if (targetTeam === 'Unassigned') await axios.delete(`${API_URL}/api/teams/${username}`);
            else await axios.post(`${API_URL}/api/teams/assign`, { username, teamName: targetTeam });
        } catch (error) { fetchData(); }
    };

    // --- RENDER HELPERS ---
    const uniqueTags = Array.from(new Set([...tags.map(t => t.name), ...teams.map(t => t.tag)]));
    const visibleTeams = activeTag === 'ALL' ? teams : teams.filter(t => t.tag === activeTag);
    const columnsToRender = [...visibleTeams.map(t => t.name), 'Unassigned'];
    const filteredProducers = producers.filter(p => p.username.toLowerCase().includes(searchQuery.toLowerCase()));

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 className="spinning" /></div>;

    return (
        <div className="dashboard-card" style={{ maxWidth: '1600px', margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 className="dashboard-header" style={{ margin: 0 }}>Hierarchical Team Management</h2>
                <button 
                    onClick={() => setShowConfig(!showConfig)} 
                    className="add-team-btn" 
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                >
                    <Settings size={16} /> 
                    System Configuration
                    <ChevronDown size={16} className={`config-chevron ${showConfig ? 'open' : ''}`} />
                </button>
            </div>

            {/* --- SYSTEM CONFIGURATION ACCORDION --- */}
            <div className={`config-panel-wrapper ${showConfig ? 'open' : ''}`}>
                <div className="config-panel-inner">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                        {[{ label: 'Tags', icon: TagIcon, stateKey: 'tag', list: tags }, { label: 'Shifts', icon: Clock, stateKey: 'shift', list: shifts }, { label: 'Supervisors', icon: ShieldCheck, stateKey: 'supervisor', list: supervisors }].map((col) => (
                            <div key={col.label} style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><col.icon size={16}/> {col.label}</div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <input type="text" placeholder={`Add ${col.label}...`} value={newMeta[col.stateKey]} onChange={e => setNewMeta({...newMeta, [col.stateKey]: e.target.value})} className="tm-input" />
                                    <button onClick={() => handleAddMeta(col.stateKey)} className="add-team-btn" style={{ padding: '0 12px' }}><Plus size={16}/></button>
                                </div>
                                <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {col.list.map(item => (
                                        <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px' }}>
                                            {item.name}
                                            <button onClick={() => handleDeleteMeta(col.stateKey, item._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- CREATE SUB-TEAM --- */}
            <form onSubmit={handleAddTeam} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16}/> Create Sub-Team</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <CustomSelect value={newTeam.tag} onChange={val => setNewTeam({...newTeam, tag: val})} options={[{ value: '', label: 'Select Parent Tag...' }, ...uniqueTags.map(t => ({ value: t, label: t }))]} containerStyle={{ width: '100%', height: '40px' }} />
                    <input type="text" placeholder="Team Name (e.g. Morning Squad)" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} className="tm-input" />
                    <input type="text" placeholder="Location (e.g. Lucknow)" value={newTeam.location} onChange={e => setNewTeam({...newTeam, location: e.target.value})} className="tm-input" />
                    <CustomSelect value={newTeam.timingSlot} onChange={val => setNewTeam({...newTeam, timingSlot: val})} options={[{ value: '', label: 'Select Shift...' }, ...shifts.map(s => ({ value: s.name, label: s.name }))]} containerStyle={{ width: '100%', height: '40px' }} />
                    <CustomSelect value={newTeam.supervisor} onChange={val => setNewTeam({...newTeam, supervisor: val})} options={[{ value: '', label: 'Select Supervisor...' }, ...supervisors.map(s => ({ value: s.name, label: s.name }))]} containerStyle={{ width: '100%', height: '40px' }} />
                </div>
                <button type="submit" className="add-team-btn" style={{ alignSelf: 'flex-end', padding: '8px 24px' }}>Create Team</button>
            </form>

            {/* --- FILTER & BULK ACTION BAR --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <CustomSelect icon={Filter} value={activeTag} onChange={(val) => setActiveTag(val)} options={[{ value: 'ALL', label: 'All Tags (Global View)' }, ...uniqueTags.map(t => ({ value: t, label: `Tag: ${t}` }))]} containerStyle={{ width: '220px', height: '40px' }} />
                    <div style={{ position: 'relative', width: '250px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Search producers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="tm-input" style={{ paddingLeft: '36px', height: '40px' }} />
                    </div>
                </div>

                {selectedUsers.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(59, 130, 246, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                        <span style={{ fontWeight: '600', color: 'var(--primary)', fontSize: '13px' }}>{selectedUsers.size} Selected</span>
                        <CustomSelect icon={MoveRight} value={bulkTargetTeam} onChange={setBulkTargetTeam} options={[{ value: '', label: 'Move to Team...' }, { value: 'Unassigned', label: 'Unassigned' }, ...teams.map(t => ({ value: t.name, label: t.name }))]} containerStyle={{ width: '200px', height: '36px' }} />
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
                            <div className="team-column-header" style={{ flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-main)' }}>{teamName}</span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <span className="team-badge">{teamProducers.length}</span>
                                        {teamName !== 'Unassigned' && (
                                            <>
                                                <button onClick={() => setEditTeamModal({ ...teamConfig, oldName: teamName })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14}/></button>
                                                <button onClick={() => handleDeleteTeam(teamName)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {teamConfig && teamName !== 'Unassigned' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={10}/> {teamConfig.location}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10}/> {teamConfig.timingSlot}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}><ShieldCheck size={10}/> {teamConfig.supervisor}</span>
                                    </div>
                                )}
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
                                            <CheckSquare size={16} color={selectedUsers.has(producer.username) ? "var(--primary)" : "var(--text-muted)"} />
                                            <User size={16} color="var(--primary)" />
                                            <span style={{ fontSize: '14px', fontWeight: '500' }}>{producer.username}</span>
                                        </div>
                                        <GripVertical size={16} color="var(--text-muted)" style={{ cursor: 'grab' }} />
                                    </div>
                                ))}
                                {teamProducers.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Empty Team</div>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* --- EDIT TEAM MODAL --- */}
            {editTeamModal && (
                <div className="tm-modal-overlay">
                    <div className="tm-modal">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0 }}>Edit Team</h3>
                            <button onClick={() => setEditTeamModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20}/></button>
                        </div>
                        <form onSubmit={handleUpdateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <CustomSelect value={editTeamModal.tag} onChange={val => setEditTeamModal({...editTeamModal, tag: val})} options={[{ value: '', label: 'Select Parent Tag...' }, ...uniqueTags.map(t => ({ value: t, label: t }))]} containerStyle={{ width: '100%', height: '40px' }} />
                            <input type="text" placeholder="Team Name" value={editTeamModal.name} onChange={e => setEditTeamModal({...editTeamModal, name: e.target.value})} className="tm-input" required />
                            <input type="text" placeholder="Location" value={editTeamModal.location} onChange={e => setEditTeamModal({...editTeamModal, location: e.target.value})} className="tm-input" required />
                            <CustomSelect value={editTeamModal.timingSlot} onChange={val => setEditTeamModal({...editTeamModal, timingSlot: val})} options={[{ value: '', label: 'Select Shift...' }, ...shifts.map(s => ({ value: s.name, label: s.name }))]} containerStyle={{ width: '100%', height: '40px' }} />
                            <CustomSelect value={editTeamModal.supervisor} onChange={val => setEditTeamModal({...editTeamModal, supervisor: val})} options={[{ value: '', label: 'Select Supervisor...' }, ...supervisors.map(s => ({ value: s.name, label: s.name }))]} containerStyle={{ width: '100%', height: '40px' }} />
                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setEditTeamModal(null)} className="tm-input" style={{ background: 'var(--bg-secondary)', textAlign: 'center', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" className="add-team-btn" style={{ flex: 1, width: '100%' }}>Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}