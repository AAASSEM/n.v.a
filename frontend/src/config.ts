// On Render, VITE_API_URL should be set in the build environment.
// For example: https://esg-compass-backend.onrender.com/api/v1
let rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// HELP: If the user accidentally pasted "VITE_API_URL = https://..." into Render
if (rawUrl.includes('VITE_API_URL =')) {
    rawUrl = rawUrl.split('VITE_API_URL =')[1].trim();
} else if (rawUrl.includes('VITE_API_URL=')) {
    rawUrl = rawUrl.split('VITE_API_URL=')[1].trim();
}

export const API_URL = rawUrl;

// The base backend URL (without /api/v1) for media/static files
export const BASE_URL = API_URL.replace('/api/v1', '');

// Debug check
if (import.meta.env.PROD) {
    console.log('--- PRODUCTION MODE ---');
    console.log('API_URL:', API_URL);
    console.log('BASE_URL:', BASE_URL);
    if (!import.meta.env.VITE_API_URL) {
        console.warn('WARNING: VITE_API_URL is missing in production build! Falling back to localhost.');
    }
} else {
    console.log('--- DEVELOPMENT MODE ---');
    console.log('API_URL:', API_URL);
    console.log('BASE_URL:', BASE_URL);
}
