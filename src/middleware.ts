import { NextRequest, NextResponse } from 'next/server';

// Rate limit configuration: route -> (requests per window)
const RATE_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  '/api/analyze': { requests: 10, windowMs: 60000 },
  '/api/translate': { requests: 20, windowMs: 60000 },
  '/api/infographic': { requests: 5, windowMs: 60000 },
  '/api/similar-search': { requests: 10, windowMs: 60000 },
  '/api/compare': { requests: 5, windowMs: 60000 },
};

// In-memory store: ip -> route -> { count, resetTime }
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitStore {
  [ip: string]: {
    [route: string]: RateLimitEntry;
  };
}

const rateLimitStore: RateLimitStore = {};

// Cleanup interval: remove stale entries every 60 seconds
const CLEANUP_INTERVAL = 60000;

let cleanupStarted = false;

function startCleanupInterval(): void {
  if (!cleanupStarted) {
    cleanupStarted = true;

    setInterval(() => {
      const now = Date.now();
      for (const ip in rateLimitStore) {
        const routes = rateLimitStore[ip];
        for (const route in routes) {
          if (routes[route].resetTime < now) {
            delete routes[route];
          }
        }
        // Remove IP entry if no routes left
        if (Object.keys(routes).length === 0) {
          delete rateLimitStore[ip];
        }
      }
    }, CLEANUP_INTERVAL);
  }
}

function getClientIp(request: NextRequest): string {
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  return 'anonymous';
}

function checkRateLimit(
  ip: string,
  route: string,
  limit: { requests: number; windowMs: number }
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();

  // Initialize IP entry if not exists
  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = {};
  }

  // Get or create rate limit entry for this route
  let entry = rateLimitStore[ip][route];
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + limit.windowMs,
    };
    rateLimitStore[ip][route] = entry;
  }

  // Check if limit exceeded
  if (entry.count >= limit.requests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment counter
  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function middleware(request: NextRequest): NextResponse | undefined {
  const pathname = request.nextUrl.pathname;

  // Only apply rate limiting to configured routes
  const matchedRoute = Object.keys(RATE_LIMITS).find((route) =>
    pathname.startsWith(route)
  );

  if (!matchedRoute) {
    return undefined;
  }

  // Start cleanup interval on first request
  startCleanupInterval();

  const clientIp = getClientIp(request);
  const limit = RATE_LIMITS[matchedRoute];
  const { allowed, retryAfter } = checkRateLimit(clientIp, matchedRoute, limit);

  if (!allowed) {
    return NextResponse.json(
      {
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }

  return undefined;
}

export const config = {
  matcher: '/api/:path*',
};
