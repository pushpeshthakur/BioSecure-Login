import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============ Users Table ============
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  displayName: text("display_name").notNull(),
  
  // Original files (kept for backward compatibility)
  faceImagePath: text("face_image_path").notNull(),
  voiceAudioPath: text("voice_audio_path").notNull(),
  
  // NEW: Cropped face (only the detected face region)
  faceImageCroppedPath: text("face_image_cropped_path"),
  
  // NEW: Face embedding (128-D vector from face_recognition library)
  faceEmbedding: jsonb("face_embedding"),
  
  // NEW: Voice embedding/template (MFCC features or speaker embedding)
  voiceTemplate: jsonb("voice_template"),
  
  // NEW: Anti-spoofing and liveness scores
  faceAntiSpoofScore: decimal("face_anti_spoof_score", { precision: 3, scale: 2 }),
  faceLivenessVerified: boolean("face_liveness_verified").default(false),
  voiceLivenessVerified: boolean("voice_liveness_verified").default(false),
  
  // NEW: Last successful authentication timestamp
  lastAuthAt: timestamp("last_auth_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// ============ Authentication Challenges Table ============
// Stores temporary challenges for voice and face verification
export const authChallenges = pgTable("auth_challenges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  
  // Challenge type: "voice_phrase" or "face_liveness"
  type: varchar("type", { length: 50 }).notNull(),
  
  // For voice challenges: random phrase to speak
  voicePhrase: text("voice_phrase"),
  
  // For face challenges: action required (e.g., "blink", "turn_left", "smile")
  faceAction: varchar("face_action", { length: 50 }),
  
  // Challenge token (unique identifier for this challenge)
  token: text("token").notNull().unique(),
  
  // When the challenge was issued
  issuedAt: timestamp("issued_at").defaultNow(),
  
  // When the challenge expires (default 5 minutes)
  expiresAt: timestamp("expires_at").notNull(),
  
  // Whether challenge has been completed
  completed: boolean("completed").default(false),
  
  // Completion timestamp
  completedAt: timestamp("completed_at"),
});

// ============ Liveness and Anti-Spoofing Logs ============
// Tracks all liveness verification attempts
export const livenessLogs = pgTable("liveness_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  
  // Type: "face_liveness" or "voice_liveness"
  type: varchar("type", { length: 50 }).notNull(),
  
  // Result: pass or fail
  passed: boolean("passed").notNull(),
  
  // Confidence score
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  
  // Detailed metrics stored as JSON
  metrics: jsonb("metrics"),
  
  attemptedAt: timestamp("attempted_at").defaultNow(),
});

// ============ Authentication Logs ============
// Audit trail for all authentication attempts
export const authLogs = pgTable("auth_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  
  // Success or failure
  success: boolean("success").notNull(),
  
  // Reason for failure
  failureReason: text("failure_reason"),
  
  // Face and voice match confidence
  faceConfidence: decimal("face_confidence", { precision: 3, scale: 2 }),
  voiceConfidence: decimal("voice_confidence", { precision: 3, scale: 2 }),
  
  // IP address for audit
  ipAddress: varchar("ip_address", { length: 45 }),
  
  attemptedAt: timestamp("attempted_at").defaultNow(),
});

// ============ Zod Schemas ============
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true,
  lastAuthAt: true,
  faceEmbedding: true,
  voiceTemplate: true,
  faceAntiSpoofScore: true,
  faceLivenessVerified: true,
  voiceLivenessVerified: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AuthChallenge = typeof authChallenges.$inferSelect;
export type LivenessLog = typeof livenessLogs.$inferSelect;
export type AuthLog = typeof authLogs.$inferSelect;

// ============ API Request/Response Schemas ============

// Step 1: Request authentication challenge
export const requestChallengeSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
});

export type RequestChallengeRequest = z.infer<typeof requestChallengeSchema>;

// Step 2: Submit face for liveness + anti-spoofing check
export const submitFaceSchema = z.object({
  challengeToken: z.string(),
  faceImage: z.string().min(1, "Face image is required"),
  // Optional: face action response (if required by challenge)
  faceActionResponse: z.enum(["blink", "turn_left", "turn_right", "smile", "nod"]).optional(),
});

export type SubmitFaceRequest = z.infer<typeof submitFaceSchema>;

// Step 3: Submit voice for challenge response
export const submitVoiceSchema = z.object({
  challengeToken: z.string(),
  voiceAudio: z.string().min(1, "Voice audio is required"),
});

export type SubmitVoiceRequest = z.infer<typeof submitVoiceSchema>;

// NEW Registration flow
export const registerRequestSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  faceImage: z.string().min(1, "Face image is required"),
  voiceAudio: z.string().min(1, "Voice recording is required"),
  // For registration, must provide complete phrase
  voicePhrase: z.string().min(5, "Please speak a phrase of at least 5 words"),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

// OLD login request (deprecated - use new challenge-based flow)
export const loginRequestSchema = z.object({
  faceImage: z.string().min(1, "Face image is required"),
  voiceAudio: z.string().min(1, "Voice recording is required"),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Response types
export type AuthResponse = {
  success: boolean;
  message: string;
  user?: User;
  matchDetails?: {
    faceMatch: boolean;
    voiceMatch: boolean;
    confidence: number;
    faceAntiSpoofScore?: number;
    faceLivenessDetected?: boolean;
    voiceLivenessDetected?: boolean;
  };
};

export type ChallengeResponse = {
  challengeToken: string;
  type: "face_liveness" | "voice_phrase" | "combined";
  voicePhrase?: string;
  faceAction?: string;
  expiresIn: number; // milliseconds
};
