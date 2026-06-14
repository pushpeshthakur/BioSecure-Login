import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execPromise = promisify(exec);

interface SpeakerEmbeddingResult {
  success: boolean;
  embedding?: number[];
  duration?: number;
  dimension?: number;
  error?: string;
}

interface SpeakerComparisonResult {
  match: boolean;
  distance: number;
  confidence: number;
  threshold?: number;
}

interface VoiceLivenessResult {
  success: boolean;
  isLive: boolean;
  confidence: number;
  metrics?: Record<string, any>;
  error?: string;
}

interface ReplayDetectionResult {
  success: boolean;
  isReplay: boolean;
  confidence: number;
  audioHash?: string;
  exactMatch?: boolean;
  error?: string;
}

interface PhraseVerificationResult {
  success: boolean;
  phraseMatched: boolean;
  confidence: number;
  metrics?: Record<string, any>;
  error?: string;
}

/**
 * Extract speaker embedding (voice print) from audio
 * Uses advanced MFCC + statistical features for robust speaker identification
 */
export async function extractSpeakerEmbedding(audioPath: string): Promise<SpeakerEmbeddingResult> {
  try {
    const pythonScript = `
import sys
sys.path.insert(0, '${__dirname}')
from voiceProcessing import extract_speaker_embedding
import json

result = extract_speaker_embedding(r'${audioPath}')
print(json.dumps(result))
`;
    
    const scriptPath = path.join(process.cwd(), `voice_embed_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      
      if (result.success && result.embedding) {
        return {
          success: true,
          embedding: result.embedding,
          duration: result.duration,
          dimension: result.dimension
        };
      }
      
      return { success: false, error: result.error || "Embedding extraction failed" };
    } catch (e) {
      fs.unlinkSync(scriptPath);
      throw e;
    }
  } catch (error) {
    console.error("Error extracting speaker embedding:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Compare two speaker embeddings
 * Returns match status and confidence score
 */
export async function compareSpeakerEmbeddings(
  embedding1: number[],
  embedding2: number[],
  threshold: number = 0.3
): Promise<SpeakerComparisonResult> {
  try {
    const pythonScript = `
import sys
sys.path.insert(0, '${__dirname}')
from voiceProcessing import compare_speaker_embeddings
import json

emb1 = ${JSON.stringify(embedding1)}
emb2 = ${JSON.stringify(embedding2)}
result = compare_speaker_embeddings(emb1, emb2, ${threshold})
print(json.dumps(result))
`;
    
    const scriptPath = path.join(process.cwd(), `voice_compare_embed_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      
      return {
        match: result.match === true,
        distance: result.distance || 0,
        confidence: result.confidence || 0,
        threshold: result.threshold || threshold
      };
    } catch (e) {
      fs.unlinkSync(scriptPath);
      throw e;
    }
  } catch (error) {
    console.error("Error comparing speaker embeddings:", error);
    return {
      match: false,
      distance: 1.0,
      confidence: 0.0
    };
  }
}

/**
 * Detect voice liveness
 * Identifies if voice is live and not synthetic/replay
 */
export async function detectVoiceLiveness(audioPath: string): Promise<VoiceLivenessResult> {
  try {
    const pythonScript = `
import sys
sys.path.insert(0, '${__dirname}')
from voiceProcessing import detect_voice_liveness
import json

result = detect_voice_liveness(r'${audioPath}')
print(json.dumps(result))
`;
    
    const scriptPath = path.join(process.cwd(), `voice_liveness_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      
      return {
        success: result.success !== false,
        isLive: result.is_live === true,
        confidence: result.confidence || 0,
        metrics: result.metrics
      };
    } catch (e) {
      fs.unlinkSync(scriptPath);
      throw e;
    }
  } catch (error) {
    console.error("Error detecting voice liveness:", error);
    return {
      success: false,
      isLive: false,
      confidence: 0.0,
      error: String(error)
    };
  }
}

/**
 * Detect replay attacks
 * Identifies if audio is a replay of previously recorded speech
 */
export async function detectReplayAttack(audioPath: string, referenceHash?: string): Promise<ReplayDetectionResult> {
  try {
    const pythonScript = `
import sys
sys.path.insert(0, '${__dirname}')
from voiceProcessing import detect_replay_attack
import json

ref_hash = ${referenceHash ? `"${referenceHash}"` : "None"}
result = detect_replay_attack(r'${audioPath}', ref_hash)
print(json.dumps(result))
`;
    
    const scriptPath = path.join(process.cwd(), `voice_replay_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      
      return {
        success: result.success !== false,
        isReplay: result.is_replay === true,
        confidence: result.confidence || 0,
        audioHash: result.audio_hash,
        exactMatch: result.exact_match || false
      };
    } catch (e) {
      fs.unlinkSync(scriptPath);
      throw e;
    }
  } catch (error) {
    console.error("Error detecting replay attack:", error);
    return {
      success: false,
      isReplay: false,
      confidence: 0.0,
      error: String(error)
    };
  }
}

/**
 * Verify that audio contains the expected phrase
 * Uses audio duration and energy heuristics (can be extended with speech recognition)
 */
export async function verifyPhraseMatch(audioPath: string, expectedPhrase: string): Promise<PhraseVerificationResult> {
  try {
    const pythonScript = `
import sys
sys.path.insert(0, '${__dirname}')
from voiceProcessing import verify_phrase_match
import json

result = verify_phrase_match(r'${audioPath}', ${JSON.stringify(expectedPhrase)})
print(json.dumps(result))
`;
    
    const scriptPath = path.join(process.cwd(), `voice_phrase_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      
      return {
        success: result.success !== false,
        phraseMatched: result.phrase_matched === true,
        confidence: result.confidence || 0,
        metrics: result.metrics
      };
    } catch (e) {
      fs.unlinkSync(scriptPath);
      throw e;
    }
  } catch (error) {
    console.error("Error verifying phrase:", error);
    return {
      success: false,
      phraseMatched: false,
      confidence: 0.0,
      error: String(error)
    };
  }
}

/**
 * Generate a random challenge phrase for voice verification
 * Returns a phrase that the user must speak
 */
export function generateVoiceChallenge(): {
  phrase: string;
  wordCount: number;
} {
  const phrases = [
    "My password is secure and unique",
    "I confirm this is my voice",
    "Biometric security is important",
    "Verify my identity now please",
    "This audio must be live recorded",
    "Random phrase challenge verification",
    "Liveness detection test now",
    "Authenticate with my voice",
    "Security and privacy matter",
    "Voice recognition system test"
  ];
  
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  const wordCount = phrase.split(" ").length;
  
  return { phrase, wordCount };
}

/**
 * Generate a challenge token for tracking challenge-response
 */
export function generateChallengeToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Validate challenge response
 * Combines all liveness and authentication checks
 */
export async function validateVoiceChallengeResponse(
  audioPath: string,
  expectedPhrase: string,
  referenceEmbedding: number[]
): Promise<{
  success: boolean;
  passed: boolean;
  confidence: number;
  checks: {
    liveness: VoiceLivenessResult;
    replay: ReplayDetectionResult;
    phraseMatch: PhraseVerificationResult;
    speakerMatch: SpeakerComparisonResult | null;
  };
  error?: string;
}> {
  try {
    // Run all checks in parallel
    const [livenessResult, replayResult, phraseResult] = await Promise.all([
      detectVoiceLiveness(audioPath),
      detectReplayAttack(audioPath),
      verifyPhraseMatch(audioPath, expectedPhrase)
    ]);
    
    // Extract speaker embedding for comparison
    const embeddingResult = await extractSpeakerEmbedding(audioPath);
    let speakerMatch = null;
    
    if (embeddingResult.success && embeddingResult.embedding && referenceEmbedding) {
      speakerMatch = await compareSpeakerEmbeddings(referenceEmbedding, embeddingResult.embedding);
    }
    
    // All checks must pass
    const allChecksPassed = 
      livenessResult.isLive &&
      !replayResult.isReplay &&
      phraseResult.phraseMatched &&
      (speakerMatch ? speakerMatch.match : true);
    
    // Calculate combined confidence
    const combinedConfidence = (
      livenessResult.confidence * 0.25 +
      (1 - replayResult.confidence) * 0.25 +
      phraseResult.confidence * 0.25 +
      (speakerMatch ? speakerMatch.confidence : 0.75) * 0.25
    );
    
    return {
      success: true,
      passed: allChecksPassed,
      confidence: combinedConfidence,
      checks: {
        liveness: livenessResult,
        replay: replayResult,
        phraseMatch: phraseResult,
        speakerMatch
      }
    };
  } catch (error) {
    return {
      success: false,
      passed: false,
      confidence: 0,
      checks: {
        liveness: { success: false, isLive: false, confidence: 0 },
        replay: { success: false, isReplay: false, confidence: 0 },
        phraseMatch: { success: false, phraseMatched: false, confidence: 0 },
        speakerMatch: null
      },
      error: String(error)
    };
  }
}
