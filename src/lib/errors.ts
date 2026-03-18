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

export class DatabaseConnectionError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.DATABASE_ERROR, HttpStatusCode.SERVICE_UNAVAILABLE, details);
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
 * Detect database connection errors and return a user-friendly message.
 * Returns null if the error is not a DB connection error.
 */
function detectDbConnectionError(error: Error): DatabaseConnectionError | null {
  const message = error.message.toLowerCase();

  if (message.includes('tenant or user not found')) {
    return new DatabaseConnectionError(
      '데이터베이스 연결 실패: Supabase 프로젝트가 일시정지(paused) 상태이거나 인증 정보가 올바르지 않습니다. Supabase 대시보드에서 프로젝트 상태를 확인하세요.',
      { originalError: error.message }
    );
  }

  if (message.includes('econnrefused')) {
    return new DatabaseConnectionError(
      '데이터베이스 연결 실패: 데이터베이스 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.',
      { originalError: error.message }
    );
  }

  if (message.includes('connection timeout') || message.includes('timeout expired')) {
    return new DatabaseConnectionError(
      '데이터베이스 연결 실패: 연결 시간이 초과되었습니다. 네트워크 상태를 확인하세요.',
      { originalError: error.message }
    );
  }

  if (message.includes('password authentication failed')) {
    return new DatabaseConnectionError(
      '데이터베이스 연결 실패: 인증에 실패했습니다. DATABASE_URL의 비밀번호를 확인하세요.',
      { originalError: error.message }
    );
  }

  if (message.includes('database') && message.includes('does not exist')) {
    return new DatabaseConnectionError(
      '데이터베이스 연결 실패: 지정된 데이터베이스가 존재하지 않습니다. DATABASE_URL을 확인하세요.',
      { originalError: error.message }
    );
  }

  if (message.includes('no pg_hba.conf entry') || message.includes('ssl/tls required')) {
    return new DatabaseConnectionError(
      '데이터베이스 연결 실패: 접근이 거부되었습니다. SSL 설정 또는 접근 권한을 확인하세요.',
      { originalError: error.message }
    );
  }

  return null;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for database connection errors first
    const dbError = detectDbConnectionError(error);
    if (dbError) {
      return dbError;
    }

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
