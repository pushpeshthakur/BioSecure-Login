import { z } from 'zod';
import { insertUserSchema, users, registerRequestSchema, loginRequestSchema, requestChallengeSchema, submitFaceSchema, submitVoiceSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  unauthorized: z.object({
    message: z.string(),
    details: z.any().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

/**
 * IMPROVED API with challenge-based multi-factor authentication
 * 
 * Flow:
 * 1. POST /api/auth/request-challenge - Get a voice/face challenge
 * 2. POST /api/auth/verify-face - Submit face with liveness check
 * 3. POST /api/auth/verify-voice - Submit voice response to challenge
 * 4. Login successful if both face + voice pass
 */

export const api = {
  auth: {
    // NEW: Request authentication challenge
    requestChallenge: {
      method: 'POST' as const,
      path: '/api/auth/request-challenge',
      input: requestChallengeSchema,
      responses: {
        200: z.object({
          challengeToken: z.string(),
          type: z.enum(['face_liveness', 'voice_phrase', 'combined']),
          voicePhrase: z.string().optional(),
          faceAction: z.string().optional(),
          expiresIn: z.number(), // milliseconds
        }),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },

    // NEW: Verify face with liveness detection
    verifyFace: {
      method: 'POST' as const,
      path: '/api/auth/verify-face',
      input: submitFaceSchema,
      responses: {
        200: z.object({
          success: z.boolean(),
          faceMatched: z.boolean(),
          livenessDetected: z.boolean(),
          antiSpoofScore: z.number(),
          confidence: z.number(),
          message: z.string(),
        }),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },

    // NEW: Verify voice challenge response
    verifyVoice: {
      method: 'POST' as const,
      path: '/api/auth/verify-voice',
      input: submitVoiceSchema,
      responses: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          user: z.custom<typeof users.$inferSelect>().optional(),
          checks: z.object({
            liveness: z.boolean(),
            replayDetected: z.boolean(),
            phraseMatched: z.boolean(),
            speakerMatched: z.boolean(),
          }),
          confidence: z.number(),
        }),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },

    // LEGACY: Original registration flow (can be updated to use embeddings)
    register: {
      method: 'POST' as const,
      path: '/api/auth/register',
      input: registerRequestSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },

    // LEGACY: Original login flow (deprecated - use challenge-based instead)
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: loginRequestSchema,
      responses: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          user: z.custom<typeof users.$inferSelect>().optional(),
          matchDetails: z.object({
            faceMatch: z.boolean(),
            voiceMatch: z.boolean(),
            confidence: z.number(),
          }).optional(),
        }),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
