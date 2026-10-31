/**
 * vitrix-api: courses, lessons, FAQ, tests and student progress.
 * Locally it runs next to the identity server (docker compose in identity-api, port 8082).
 * PRODUCTION_CONTENT_URL stays '' until vitrix-api is deployed: the published site then shows the
 * built-in course list from site-data.ts, hides tests/lessons and the admin panel, exactly as before.
 */
const LOCAL_CONTENT_URL: string = 'http://localhost:8082';
const PRODUCTION_CONTENT_URL: string = 'https://vitrix-api.onrender.com'; // Render (vitrix-api)

const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const CONTENT_API_URL: string = isLocal ? LOCAL_CONTENT_URL : PRODUCTION_CONTENT_URL;
export const CONTENT_ENABLED = CONTENT_API_URL !== '';
