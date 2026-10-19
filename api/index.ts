import express from 'express';
import dotenv from 'dotenv';
import { apiRouter } from '../src/server/routes';

dotenv.config();

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount the API Router directly at root for Vercel /api/ handler
app.use('/', apiRouter);

export default app;
