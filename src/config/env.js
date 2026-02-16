import dotenv from 'dotenv';

// Load .env file BEFORE accessing any process.env values
dotenv.config();

export const BIGQUERY_TIMEZONE = 'Europe/Oslo';
export const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL;
export const SITEIMPROVE_BASE_URL = process.env.SITEIMPROVE_BASE_URL;
export const UMAMI_BASE_URL = process.env.UMAMI_BASE_URL;
export const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;

if (!BACKEND_BASE_URL) {
  throw new Error('Missing env var: BACKEND_BASE_URL');
}
if (!SITEIMPROVE_BASE_URL) {
  throw new Error('Missing env var: SITEIMPROVE_BASE_URL');
}
if (!UMAMI_BASE_URL) {
  throw new Error('Missing env var: UMAMI_BASE_URL');
}
if (!GCP_PROJECT_ID) {
  throw new Error('Missing env var: GCP_PROJECT_ID');
}
