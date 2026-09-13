import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../lib/apiError';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // express.json() throws its own errors for bodies it can't handle. These are the
  // caller's fault, so they'd be misleading as 500s.
  const type = (err as { type?: string })?.type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body is too large' });
    return;
  }

  // Anything unexpected: log the detail for us, return something generic to the
  // client so internal errors and stack traces don't leak out.
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
};
