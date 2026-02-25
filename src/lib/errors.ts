/**
 * Standardized Error Handling for arVix Portal
 *
 * Custom error classes and utilities for consistent error handling
 * across API routes and application code.
 */

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorCode {
  // Client Errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFLICT = 'CONFLICT',

  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
}

export enum HttpStatusCode {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

// ============================================================================
// Custom Error Classes
// ============================================================================

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: HttpStatusCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.BAD_REQUEST, HttpStatusCode.BAD_REQUEST, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly issues: unknown[]) {
    super(message, ErrorCode.VALIDATION_ERROR, HttpStatusCode.BAD_REQUEST, { issues });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;
    super(message, ErrorCode.NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.DATABASE_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR, details);
  }
}

export class ExternalAPIError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super(
      `${service} error: ${message}`,
      ErrorCode.EXTERNAL_API_ERROR,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      details
    );
  }
}

export class InternalError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.INTERNAL_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR, details);
  }
}

// ============================================================================
// Error Response Interface
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a standardized error response object
 */
export function createErrorResponse(error: AppError): ErrorResponse {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message, {
      originalError: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }

  if (typeof error === 'string') {
    return new InternalError(error);
  }

  return new InternalError('알 수 없는 오류가 발생했습니다', { originalError: error });
}

/**
 * Log error with context
 */
export function logError(context: string, error: unknown): void {
  const appError = error instanceof AppError ? error : toAppError(error);

  console.error(`[${context}]`, {
    code: appError.code,
    message: appError.message,
    statusCode: appError.statusCode,
    details: appError.details,
  });
}

/**
 * Wrap async route handler with error handling
 * Usage: export const GET = withErrorHandler(async (request) => { ... })
 */
export function withErrorHandler<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>,
  context: string = 'API'
): (request: T) => Promise<NextResponse> {
  return async (request: T): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      logError(context, error);

      const appError = toAppError(error);
      return NextResponse.json(createErrorResponse(appError), {
        status: appError.statusCode,
      });
    }
  };
}

// ============================================================================
// Type Imports (for Next.js)
// ============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
