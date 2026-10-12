import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createHealthRouter } from './health.mts';

describe('createHealthRouter', () => {
  it('answers GET /api/health with 200 and a JSON ok status', async () => {
    const applicationWithOnlyHealthRouter = express().use(createHealthRouter());

    const healthResponse = await supertest(applicationWithOnlyHealthRouter).get('/api/health');

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.headers['content-type']).toMatch(/application\/json/);
    expect(healthResponse.body).toEqual({ status: 'ok' });
  });

  it('does not answer other HTTP methods on the health path', async () => {
    const applicationWithOnlyHealthRouter = express().use(createHealthRouter());

    const postResponse = await supertest(applicationWithOnlyHealthRouter).post('/api/health');

    expect(postResponse.status).toBe(404);
  });
});
