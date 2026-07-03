import { useState } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { PROJECT_ICON_NAMES, getProjectIcon } from '../config/projectIcons';
import './ProjectManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const EMPTY_FORM = { name: '', projectId: '', icon: 'FolderKanban', syncQc: false };

export default function ProjectManagement() {
    const queryClient = useQueryClient();
    const { projects, isLoading, isError } = useProjects();

    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState('');

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

    const handleAdd = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.name.trim() || !form.projectId.trim()) {
            setError('Project name and Lightwheel Project ID are both required.');
            return;
        }
        setIsSaving(true);
        try {
            await axios.post(`${API_URL}/api/projects`, form);
            setForm(EMPTY_FORM);
            refresh();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add project.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (project, field) => {
        setError('');
        setBusyId(project._id);
        try {
            await axios.put(`${API_URL}/api/projects/${project._id}`, { [field]: !project[field] });
            refresh();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update project.');
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (project) => {
        if (!window.confirm(`Delete "${project.name}"? Its already-synced data will be hidden across the entire platform.`)) return;
        setError('');
        setBusyId(project._id);
        try {
            await axios.delete(`${API_URL}/api/projects/${project._id}`);
            refresh();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete project.');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="dashboard-card pm-container">
            <div className="pm-header">
                <div className="pm-header-title">
                    <div className="pm-header-icon"><FolderKanban size={24} /></div>
                    <div>
                        <h2 className="dashboard-header" style={{ margin: 0 }}>Manage Task Lists</h2>
                        <p className="pm-subtitle">
                            Add, remove, enable or disable projects. Disabling a project instantly hides all of
                            its data — task lists, dashboards, QC, anomalies and leaderboards — everywhere.
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="pm-error"><AlertCircle size={18} /><span>{error}</span></div>
            )}

            {/* --- ADD FORM --- */}
            <form className="pm-add-form" onSubmit={handleAdd}>
                <div className="pm-field">
                    <label>Project Name</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Restaurant"
                    />
                </div>
                <div className="pm-field pm-field-wide">
                    <label>Lightwheel Project ID</label>
                    <input
                        type="text"
                        value={form.projectId}
                        onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                        placeholder="e.g. f81e5d71-373e-4c68-b9a4-32c80f91c23f"
                    />
                </div>

                <div className="pm-field pm-field-full">
                    <label>Icon</label>
                    <div className="pm-icon-picker">
                        {PROJECT_ICON_NAMES.map((iconName) => {
                            const Icon = getProjectIcon(iconName);
                            return (
                                <button
                                    type="button"
                                    key={iconName}
                                    className={`pm-icon-btn ${form.icon === iconName ? 'selected' : ''}`}
                                    onClick={() => setForm({ ...form, icon: iconName })}
                                    title={iconName}
                                >
                                    <Icon size={18} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="pm-field-inline">
                    <label className="pm-checkbox">
                        <input
                            type="checkbox"
                            checked={form.syncQc}
                            onChange={(e) => setForm({ ...form, syncQc: e.target.checked })}
                        />
                        <span>Also sync QC records for this project</span>
                    </label>

                    <button type="submit" className="pm-add-btn" disabled={isSaving}>
                        {isSaving ? <Loader2 size={16} className="spinning" /> : <Plus size={16} />}
                        {isSaving ? 'Adding...' : 'Add Project'}
                    </button>
                </div>
            </form>

            {/* --- TABLE --- */}
            {isLoading ? (
                <div className="pm-empty">Loading projects...</div>
            ) : isError ? (
                <div className="pm-empty">Failed to load projects.</div>
            ) : (
                <div className="pm-table-wrapper">
                    <table className="pm-table">
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Key</th>
                                <th>Lightwheel ID</th>
                                <th style={{ textAlign: 'center' }}>Sync QC</th>
                                <th style={{ textAlign: 'center' }}>Enabled</th>
                                <th style={{ textAlign: 'center' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.length === 0 ? (
                                <tr><td colSpan="6" className="pm-empty">No projects yet. Add one above.</td></tr>
                            ) : (
                                projects.map((p) => {
                                    const Icon = getProjectIcon(p.icon);
                                    const busy = busyId === p._id;
                                    return (
                                        <tr key={p._id} className={p.enabled ? '' : 'pm-row-disabled'}>
                                            <td>
                                                <div className="pm-project-cell">
                                                    <div className="pm-project-icon"><Icon size={18} /></div>
                                                    <span className="pm-project-name">{p.name}</span>
                                                </div>
                                            </td>
                                            <td><span className="pm-key-badge">{p.key}</span></td>
                                            <td><span className="pm-id-mono">{p.projectId}</span></td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    className={`pm-toggle ${p.syncQc ? 'on' : ''}`}
                                                    disabled={busy}
                                                    onClick={() => handleToggle(p, 'syncQc')}
                                                    title="Toggle QC sync"
                                                >
                                                    <span className="pm-toggle-knob" />
                                                </button>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    className={`pm-toggle ${p.enabled ? 'on' : ''}`}
                                                    disabled={busy}
                                                    onClick={() => handleToggle(p, 'enabled')}
                                                    title="Toggle enabled"
                                                >
                                                    <span className="pm-toggle-knob" />
                                                </button>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    className="pm-delete-btn"
                                                    disabled={busy}
                                                    onClick={() => handleDelete(p)}
                                                    title="Delete project"
                                                >
                                                    {busy ? <Loader2 size={16} className="spinning" /> : <Trash2 size={16} />}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
