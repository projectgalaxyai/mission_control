import { Auth0Client } from '@auth0/nextjs-auth0/server';

/**
 * Auth0 client for dashboard.projectgalaxyai.com.
 * Uses AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET.
 * Set APP_BASE_URL in production (e.g. https://dashboard.projectgalaxyai.com).
 */
export const auth0 = new Auth0Client();
