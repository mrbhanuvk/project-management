import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import {
  clerkMiddleware,
  requireAuth,
  getAuth,
  clerkClient
} from '@clerk/express';

import { serve } from 'inngest/express';
import { inngest, functions } from './src/inngest/index.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

// Inngest endpoint
app.use(
  '/api/inngest',
  serve({
    client: inngest,
    functions,
  })
);

// Public route
app.get('/', (req, res) => {
  res.send('Server is live!');
});

// Protected route
app.get('/protected', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);

    const user = await clerkClient.users.getUser(userId);

    res.json({
      message: 'Protected route accessed',
      user,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: 'Internal server error',
    });
  }
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

