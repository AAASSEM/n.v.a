// On Render, VITE_API_URL should be set in the build environment.
// For example: https://esg-compass-backend.onrender.com/api/v1
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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
