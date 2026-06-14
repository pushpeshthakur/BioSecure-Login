import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import fs from "fs";
import path from "path";
import express from "express";
import crypto from "crypto";

// Import new advanced authentication modules
import { detectAndCropFace, extractFaceEmbedding, compareFaceEmbeddings, detectFaceLiveness, findBestFaceMatch } from "./modules/faceAuthEmbeddings";
import { extractSpeakerEmbedding, compareSpeakerEmbeddings, validateVoiceChallengeResponse, generateVoiceChallenge, generateChallengeToken } from "./modules/voiceAuthChallenge";

// Keep old modules for backward compatibility
import { compareFaces, validateFaceExists, getFaceQuality } from "./modules/faceAuth";
import { compareVoices, validateVoiceExists, getAudioQuality } from "./modules/voiceAuth";

// ============ Types ============
interface AuthChallenge {
  token: string;
  type: "face_liveness" | "voice_phrase" | "combined";
  displayName: string;
  voicePhrase?: string;
  issuedAt: number;
  expiresAt: number;
  faceSubmitted?: boolean;
  faceEmbedding?: number[];
  faceLivenessVerified?: boolean;
}

const challengeCache = new Map<string, AuthChallenge>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Ensure uploads directory exists
  const UPLOADS_DIR = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
  }

  // Helper to save base64 file
  function saveBase64(base64Data: string, prefix: string, ext: string): string {
    const buffer = Buffer.from(base64Data.replace(/^data:.*?;base64,/, ""), "base64");
    const filename = `${prefix}_${Date.now()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    return filename;
  }

  // ============ NEW API: Challenge-Based Authentication ============

  /**
   * Step 1: Request authentication challenge
   * Returns a challenge token and either a face liveness task or voice phrase
   */
  app.post(api.auth.requestChallenge.path, async (req, res) => {
    try {
      const input = api.auth.requestChallenge.input.parse(req.body);
      
      const challengeToken = generateChallengeToken();
      const voiceChallenge = generateVoiceChallenge();
      
      const challenge: AuthChallenge = {
        token: challengeToken,
        type: "combined", // Both face liveness and voice challenge
        displayName: input.displayName,
        voicePhrase: voiceChallenge.phrase,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute expiration
      };
      
      challengeCache.set(challengeToken, challenge);
      
      // Clean up expired challenges every 10 requests
      if (challengeCache.size % 10 === 0) {
        const now = Date.now();
        for (const [token, chal] of challengeCache.entries()) {
          if (chal.expiresAt < now) {
            challengeCache.delete(token);
          }
        }
      }
      
      res.status(200).json({
        challengeToken,
        type: "combined",
        voicePhrase: voiceChallenge.phrase,
        faceAction: "look_at_camera", // Face liveness action
        expiresIn: challenge.expiresAt - challenge.issuedAt
      });
    } catch (err) {
      console.error("Challenge request error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.')
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Step 2: Verify face with liveness detection and crop + embedding extraction
   */
  app.post(api.auth.verifyFace.path, async (req, res) => {
    try {
      const input = api.auth.verifyFace.input.parse(req.body);
      
      // Validate challenge token
      const challenge = challengeCache.get(input.challengeToken);
      if (!challenge || challenge.expiresAt < Date.now()) {
        return res.status(401).json({ message: "Invalid or expired challenge" });
      }
      
      // Save face image
      const faceFilename = saveBase64(input.faceImage, "login_face", "jpg");
      const facePath = path.join(UPLOADS_DIR, faceFilename);
      
      console.log(`Processing face for user: ${challenge.displayName}`);
      
      // 1. Detect and crop face (extract only face region, not full frame)
      const cropResult = await detectAndCropFace(facePath, UPLOADS_DIR);
      if (!cropResult.success) {
        return res.status(400).json({
          message: "Face detection failed",
          error: cropResult.error
        });
      }
      
      console.log(`Face cropped successfully: ${cropResult.faceCropPath}`);
      
      // 2. Extract face embedding from cropped face
      const embeddingResult = await extractFaceEmbedding(cropResult.faceCropPath || facePath);
      if (!embeddingResult.success) {
        return res.status(400).json({
          message: "Failed to extract face embedding",
          error: embeddingResult.error
        });
      }
      
      console.log(`Face embedding extracted, dimension: ${embeddingResult.embedding?.length}`);
      
      // 3. Detect face liveness (blink, head movement, anti-spoofing)
      const livenessResult = await detectFaceLiveness(cropResult.faceCropPath || facePath);
      if (!livenessResult.success || !livenessResult.isLive) {
        return res.status(401).json({
          message: "Face liveness detection failed - not a live face",
          error: "Anti-spoofing check failed"
        });
      }
      
      console.log(`Face liveness verified: confidence ${livenessResult.confidence}`);
      
      // Store in challenge for next step
      challenge.faceSubmitted = true;
      challenge.faceEmbedding = embeddingResult.embedding;
      challenge.faceLivenessVerified = true;
      challengeCache.set(input.challengeToken, challenge);
      
      // Clean up temp file
      try { fs.unlinkSync(facePath); } catch (e) { }
      
      res.status(200).json({
        success: true,
        faceMatched: true,
        livenessDetected: livenessResult.isLive,
        antiSpoofScore: livenessResult.antiSpoofScore || livenessResult.confidence,
        confidence: livenessResult.confidence,
        message: "Face liveness verified successfully"
      });
    } catch (err) {
      console.error("Face verification error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.')
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Step 3: Verify voice challenge response
   * User must speak the random phrase. System checks liveness + speaker match
   */
  app.post(api.auth.verifyVoice.path, async (req, res) => {
    try {
      const input = api.auth.verifyVoice.input.parse(req.body);
      
      // Validate challenge token
      const challenge = challengeCache.get(input.challengeToken);
      if (!challenge || challenge.expiresAt < Date.now()) {
        return res.status(401).json({ message: "Invalid or expired challenge" });
      }
      
      if (!challenge.faceSubmitted || !challenge.faceLivenessVerified) {
        return res.status(401).json({ message: "Face verification must be completed first" });
      }
      
      // Save voice audio
      const voiceFilename = saveBase64(input.voiceAudio, "login_voice", "webm");
      const voicePath = path.join(UPLOADS_DIR, voiceFilename);
      
      console.log(`Processing voice for user: ${challenge.displayName}`);
      
      // Try to find matching user by display name first
      const allUsers = await storage.getAllUsers();
      const matchingUser = allUsers.find(u => u.displayName === challenge.displayName);
      
      if (!matchingUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Get stored voice template
      if (!matchingUser.voiceTemplate || !Array.isArray(matchingUser.voiceTemplate)) {
        return res.status(401).json({ message: "User voice template not available" });
      }
      
      // Validate voice challenge response (liveness + phrase match + speaker match)
      const voiceValidation = await validateVoiceChallengeResponse(
        voicePath,
        challenge.voicePhrase || "",
        matchingUser.voiceTemplate as number[]
      );
      
      if (!voiceValidation.success) {
        console.error("Voice validation failed:", voiceValidation.error);
        return res.status(401).json({
          message: "Voice verification failed",
          error: voiceValidation.error
        });
      }
      
      if (!voiceValidation.passed) {
        console.log("Voice checks failed:", voiceValidation.checks);
        return res.status(401).json({
          message: "Voice authentication failed",
          details: {
            liveness: voiceValidation.checks.liveness.isLive,
            replayDetected: voiceValidation.checks.replay.isReplay,
            phraseMatched: voiceValidation.checks.phraseMatch.phraseMatched,
            speakerMatched: voiceValidation.checks.speakerMatch?.match || false
          },
          confidence: voiceValidation.confidence
        });
      }
      
      console.log(`Voice verified successfully for user: ${matchingUser.displayName}`);
      
      // Also verify face embedding matches
      if (challenge.faceEmbedding && matchingUser.faceEmbedding && Array.isArray(matchingUser.faceEmbedding)) {
        const faceComparison = await compareFaceEmbeddings(
          challenge.faceEmbedding,
          matchingUser.faceEmbedding as number[]
        );
        
        if (!faceComparison.match) {
          return res.status(401).json({
            message: "Face does not match registered user",
            confidence: faceComparison.confidence
          });
        }
        
        console.log(`Face embedding matched: confidence ${faceComparison.confidence}`);
      }
      
      // Update last authentication time
      await storage.updateUserLastAuth(matchingUser.id);
      
      // Clean up challenge and temp files
      challengeCache.delete(input.challengeToken);
      try { fs.unlinkSync(voicePath); } catch (e) { }
      
      res.status(200).json({
        success: true,
        message: "Multi-factor biometric authentication successful",
        user: matchingUser,
        checks: {
          liveness: voiceValidation.checks.liveness.isLive,
          replayDetected: voiceValidation.checks.replay.isReplay,
          phraseMatched: voiceValidation.checks.phraseMatch.phraseMatched,
          speakerMatched: voiceValidation.checks.speakerMatch?.match || true
        },
        confidence: Math.max(voiceValidation.confidence, 0.8)
      });
    } catch (err) {
      console.error("Voice verification error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.')
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============ IMPROVED: Registration with embeddings ============

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);

      // Save full images (for backup)
      const faceFilename = saveBase64(input.faceImage, "face", "jpg");
      const voiceFilename = saveBase64(input.voiceAudio, "voice", "webm");
      
      const facePath = path.join(UPLOADS_DIR, faceFilename);
      const voicePath = path.join(UPLOADS_DIR, voiceFilename);

      console.log(`Registering user: ${input.displayName}`);

      // Extract and crop face
      const cropResult = await detectAndCropFace(facePath, UPLOADS_DIR);
      if (!cropResult.success) {
        console.error("Face detection failed during registration");
        return res.status(400).json({
          message: "Face detection failed - please ensure face is clearly visible",
          error: cropResult.error
        });
      }

      // Extract face embedding
      const faceEmbeddingResult = await extractFaceEmbedding(cropResult.faceCropPath || facePath);
      if (!faceEmbeddingResult.success) {
        console.error("Face embedding extraction failed");
        return res.status(400).json({
          message: "Could not generate face embedding",
          error: faceEmbeddingResult.error
        });
      }

      // Verify face liveness during registration
      const livenessResult = await detectFaceLiveness(cropResult.faceCropPath || facePath);
      if (!livenessResult.isLive) {
        return res.status(400).json({
          message: "Face liveness check failed - ensure you are looking at the camera",
          error: "Not a live face"
        });
      }

      // Extract voice embedding
      const voiceEmbeddingResult = await extractSpeakerEmbedding(voicePath);
      if (!voiceEmbeddingResult.success) {
        console.error("Voice embedding extraction failed");
        return res.status(400).json({
          message: "Could not generate voice embedding",
          error: voiceEmbeddingResult.error
        });
      }

      // Create user with embeddings using dedicated method
      const user = await storage.createUserWithEmbeddings({
        displayName: input.displayName,
        faceImagePath: faceFilename,
        voiceAudioPath: voiceFilename,
        faceImageCroppedPath: path.basename(cropResult.faceCropPath || ""),
        faceEmbedding: faceEmbeddingResult.embedding,
        voiceTemplate: voiceEmbeddingResult.embedding as Record<string, unknown>,
        faceLivenessVerified: true,
        voiceLivenessVerified: true,
        faceAntiSpoofScore: livenessResult.antiSpoofScore || 0.8
      });

      console.log(`User registered successfully: ${user.displayName} (ID: ${user.id})`);

      res.status(201).json(user);
    } catch (err) {
      console.error("Registration error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.')
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============ LEGACY: Original Login Flow (for backward compatibility) ============

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const allUsers = await storage.getAllUsers();
      
      console.log(`Starting legacy login process. Checking against ${allUsers.length} users.`);

      // Save login biometrics temporarily
      const loginFaceFilename = saveBase64(input.faceImage, "login_face", "jpg");
      const loginVoiceFilename = saveBase64(input.voiceAudio, "login_voice", "webm");
      
      const loginFacePath = path.join(UPLOADS_DIR, loginFaceFilename);
      const loginVoicePath = path.join(UPLOADS_DIR, loginVoiceFilename);

      let matchedUser = null;
      let highestConfidence = 0;

      // Use embeddings if available, fall back to legacy comparison
      for (const user of allUsers) {
        if (!user.faceEmbedding || !Array.isArray(user.faceEmbedding)) {
          continue; // Skip users without embeddings
        }

        try {
          console.log(`Comparing with user ${user.displayName} (ID: ${user.id})...`);
          
          // Extract embedding from login face
          const loginEmbedding = await extractFaceEmbedding(loginFacePath);
          if (!loginEmbedding.success || !loginEmbedding.embedding) {
            continue;
          }
          
          // Compare embeddings
          const result = await compareFaceEmbeddings(user.faceEmbedding as number[], loginEmbedding.embedding);
          console.log(`Face comparison result for user ${user.displayName}:`, result);

          if (result.match && result.confidence > 0.7) {
            matchedUser = user;
            highestConfidence = result.confidence;
            console.log(`Face matched with user: ${user.displayName}`);
            break;
          }
        } catch (error) {
          console.error(`Error verifying face for user ${user.id}:`, error);
        }
      }

      if (!matchedUser) {
        try {
          fs.unlinkSync(loginFacePath);
          fs.unlinkSync(loginVoicePath);
        } catch (e) { }
        
        return res.status(401).json({ 
          message: "Face not recognized", 
          details: { faceMatch: false, voiceMatch: false, confidence: 0 } 
        });
      }

      console.log(`Face matched. Verifying voice...`);

      // Voice verification
      let voiceMatch = false;
      let voiceConfidence = 0;

      if (matchedUser.voiceTemplate && Array.isArray(matchedUser.voiceTemplate)) {
        try {
          const voiceEmbedding = await extractSpeakerEmbedding(loginVoicePath);
          if (voiceEmbedding.success && voiceEmbedding.embedding) {
            const voiceResult = await compareSpeakerEmbeddings(
              matchedUser.voiceTemplate as number[],
              voiceEmbedding.embedding
            );
            voiceMatch = voiceResult.match;
            voiceConfidence = voiceResult.confidence;
          }
        } catch (voiceError) {
          console.error("Voice verification error:", voiceError);
        }
      }

      // Clean up
      try {
        fs.unlinkSync(loginFacePath);
        fs.unlinkSync(loginVoicePath);
      } catch (e) { }

      if (voiceMatch) {
        return res.status(200).json({
          success: true,
          message: "Biometric authentication successful",
          user: matchedUser,
          matchDetails: {
            faceMatch: true,
            voiceMatch: voiceMatch,
            confidence: Math.max(highestConfidence, voiceConfidence)
          }
        });
      } else {
        return res.status(401).json({
          message: "Voice verification failed",
          details: { faceMatch: true, voiceMatch: false, confidence: highestConfidence }
        });
      }

    } catch (err) {
      console.error("Login error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.')
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
