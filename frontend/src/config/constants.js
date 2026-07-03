const isProduction = window.location.hostname !== 'localhost';

export const API_URL = isProduction
    ? 'https://lw.gts.ai'
    : 'http://localhost:5000';

// Projects (task lists) are now managed dynamically via the Project registry
// (backend /api/projects + the useProjects hook), not hard-coded here.