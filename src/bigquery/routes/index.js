import express from 'express';

import { createDiagnosisRouter } from './diagnosisRoutes.js';
import { createSqlRouter } from './sqlRoutes.js';
import { createEventRouter } from './eventRoutes.js';
import { createDashboardRouter } from './dashboardRoutes.js';
import { createTrafficRouter } from './trafficRoutes.js';

export function createBigQueryRouter({ bigquery, GCP_PROJECT_ID, BIGQUERY_TIMEZONE }) {
  const router = express.Router();

  router.use(createDiagnosisRouter({ bigquery, GCP_PROJECT_ID }));
  router.use(createSqlRouter({ bigquery }));
  router.use(createEventRouter({ bigquery, GCP_PROJECT_ID, BIGQUERY_TIMEZONE }));
  router.use(createDashboardRouter({ bigquery, GCP_PROJECT_ID }));
  router.use(createTrafficRouter({ bigquery, GCP_PROJECT_ID, BIGQUERY_TIMEZONE }));

  return router;
}

