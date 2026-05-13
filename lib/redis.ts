import { Redis } from '@upstash/redis'

// Server-only. UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are read
// from server environment variables only — never exposed to the client bundle.
// (Mirrors the OPENAI_API_KEY pattern in app/api/ocr/route.ts.)
export const redis = Redis.fromEnv()
