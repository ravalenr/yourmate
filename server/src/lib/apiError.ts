/**
 * Throw these from anywhere. The error handler in middleware/errorHandler.ts
 * turns them into a JSON response with the right HTTP status code.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const unauthorized = (message = 'Please sign in') => new ApiError(401, message);
export const forbidden = (message = "You don't have access to that") => new ApiError(403, message);
export const notFound = (message = 'Not found') => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);
