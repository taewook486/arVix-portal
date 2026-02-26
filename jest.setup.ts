// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// @MX:NOTE: Set up test environment variables
// Must be set before any module imports that use process.env
process.env.OPENAI_API_KEY = 'test-api-key-for-jest'
process.env.OPENAI_BASE_URL = 'https://api.test.com'

// Mock Next.js headers and cookies
jest.mock('next/headers', () => ({
  headers: jest.fn(),
  cookies: jest.fn(),
}))

// Mock Next.js navigation for client components
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Polyfill for fetch
if (!global.fetch) {
  global.fetch = jest.fn() as any
}

// Polyfill for TextEncoder
if (typeof (global as any).TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(input: string): Uint8Array {
      const utf8 = [];
      for (let i = 0; i < input.length; i++) {
        let charcode = input.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        } else {
          i++;
          charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (input.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        }
      }
      return new Uint8Array(utf8);
    }
  }
}

// Polyfill for AbortController
if (typeof (global as any).AbortController === 'undefined') {
  class AbortController {
    signal: any;
    _abortController: any;

    constructor() {
      this._abortController = {
        signal: {},
        abort: () => {
          this.signal.aborted = true;
        },
      };
      this.signal = this._abortController.signal;
    }

    abort() {
      this._abortController.abort();
    }
  }
  global.AbortController = AbortController as any;
}

// Polyfill native Request and Response for Next.js API routes in Jest
// Next.js 15+ uses native Request/Response which are not available in Jest jsdom environment
if (typeof (global as any).Request === 'undefined') {
  ;(global as any).Request = class Request {
    url: string
    method: string
    headers: Headers
    body: any
    cache: any
    credentials: any
    destination: any
    integrity: any
    mode: any
    redirect: any
    referrer: any
    referrerPolicy: any

    constructor(input: string | RequestInfo, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : (input as any).url || ''
      this.method = init?.method || 'GET'
      this.headers = new Headers(init?.headers)
      this.body = init?.body
    }

    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }

    async text() {
      return this.body?.toString() || ''
    }

    clone() {
      return new Request(this.url, {
        method: this.method,
        headers: this.headers,
        body: this.body,
      })
    }
  }
}

if (typeof (global as any).Response === 'undefined') {
  ;(global as any).Response = class Response {
    status: number
    statusText: string
    headers: Headers
    body: any

    constructor(body?: any, init?: { status?: number; statusText?: string; headers?: HeadersInit }) {
      this.status = init?.status || 200
      this.statusText = init?.statusText || 'OK'
      this.headers = new Headers(init?.headers)
      this.body = body
    }

    static json(data: any, init?: { status?: number; statusText?: string; headers?: HeadersInit }) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers as Record<string, string>),
        },
      })
    }

    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }
  }
}
