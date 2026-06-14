import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import fs from "fs";
import path from "path";
import express from "express";
import { compareFaces, validateFaceExists, getFaceQuality } from "./modules/faceAuth";
import { compareVoices, validateVoiceExists, getAudioQuality } from "./modules/voiceAuth";

// Increase payload size for base64 images/audio
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
    return filename; // Store relative filename
  }

  // Register User
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);

      // Save files
      const faceFilename = saveBase64(input.faceImage, "face", "jpg");
      // Use webm for audio as typically recorded by browsers
      const voiceFilename = saveBase64(input.voiceAudio, "voice", "webm");

      const user = await storage.createUser({
        displayName: input.displayName,
        faceImagePath: faceFilename,
        voiceAudioPath: voiceFilename,
      });

      res.status(201).json(user);
    } catch (err) {
      console.error("Registration error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Login User
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const allUsers = await storage.getAllUsers();
      
      console.log(`Starting login process. Checking against ${allUsers.length} users.`);

      // Save login biometrics temporarily
      const loginFaceFilename = saveBase64(input.faceImage, "login_face", "jpg");
      const loginVoiceFilename = saveBase64(input.voiceAudio, "login_voice", "webm");
      
      const loginFacePath = path.join(UPLOADS_DIR, loginFaceFilename);
      const loginVoicePath = path.join(UPLOADS_DIR, loginVoiceFilename);

      let matchedUser = null;
      let highestConfidence = 0;

      // 1. Face Identification (1:N) using OpenCV with early exit
      // Iterate through users and compare faces - stop on strong match
      for (const user of allUsers) {
        const storedFacePath = path.join(UPLOADS_DIR, user.faceImagePath);
        if (!fs.existsSync(storedFacePath)) continue;

        try {
          console.log(`Comparing face with user ${user.displayName} (ID: ${user.id})...`);
          
          // Compare faces using OpenCV
          const result = await compareFaces(storedFacePath, loginFacePath);
          console.log(`Face comparison result for user ${user.displayName}:`, result);

          if (result.match && result.confidence > 0.7) {
            matchedUser = user;
            highestConfidence = result.confidence;
            console.log(`Face matched with user: ${user.displayName} (confidence: ${result.confidence})`);
            // Strong match found - exit immediately to save time
            break;
          }
        } catch (error) {
          console.error(`Error verifying face for user ${user.id}:`, error);
        }
      }

      if (!matchedUser) {
        // Clean up temporary files
        try {
          fs.unlinkSync(loginFacePath);
          fs.unlinkSync(loginVoicePath);
        } catch (e) {
          console.warn("Could not clean up temporary login files");
        }
        
        return res.status(401).json({ 
          message: "Face not recognized", 
          details: { faceMatch: false, voiceMatch: false, confidence: 0 } 
        });
      }

      console.log(`Face matched with user: ${matchedUser.displayName}. Verifying voice...`);

      // 2. Voice Verification (1:1) using MFCC
      const storedVoicePath = path.join(UPLOADS_DIR, matchedUser.voiceAudioPath);
      let voiceMatch = false;
      let voiceConfidence = 0;

      if (fs.existsSync(storedVoicePath)) {
        try {
          console.log(`Comparing voice with user ${matchedUser.displayName}...`);
          
          // Compare voices using MFCC
          const voiceResult = await compareVoices(storedVoicePath, loginVoicePath);
          console.log(`Voice comparison result:`, voiceResult);
          
          voiceMatch = voiceResult.match;
          voiceConfidence = voiceResult.confidence;
        } catch (voiceError) {
          console.error("Error verifying voice:", voiceError);
          // Voice verification failed - return error response
          
          // Clean up temporary files
          try {
            fs.unlinkSync(loginFacePath);
            fs.unlinkSync(loginVoicePath);
          } catch (e) {
            console.warn("Could not clean up temporary login files");
          }
          
          return res.status(401).json({
            message: "Voice verification failed - authentication cancelled",
            details: { faceMatch: true, voiceMatch: false, confidence: highestConfidence }
          });
        }
      }

      // Clean up temporary files
      try {
        fs.unlinkSync(loginFacePath);
        fs.unlinkSync(loginVoicePath);
      } catch (e) {
        console.warn("Could not clean up temporary login files");
      }

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
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
