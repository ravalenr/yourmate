// Lets us attach the signed-in user's id to the request object.
// Set by the requireAuth middleware; read via currentUserId(req).
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
