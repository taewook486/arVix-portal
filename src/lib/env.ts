import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_BASE_URL: z.string().optional(),
});

function validateEnv(): z.infer<typeof serverEnvSchema> {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      '[ENV] Missing required environment variables:',
      result.error.flatten().fieldErrors
    );
  }
  return result.success ? result.data : (process.env as unknown as z.infer<typeof serverEnvSchema>);
}

export const env = validateEnv();
