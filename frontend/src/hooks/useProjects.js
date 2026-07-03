import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Shared source of truth for the dynamic project (task-list) registry.
// Every tab / filter / dropdown across the app builds itself from `enabledProjects`.
export function useProjects() {
    const query = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const res = await axios.get(`${API_URL}/api/projects`);
            return res.data;
        },
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false
    });

    const projects = query.data || [];
    const enabledProjects = projects
        .filter(p => p.enabled)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    return { ...query, projects, enabledProjects };
}
