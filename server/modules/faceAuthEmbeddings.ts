import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

interface FaceEmbeddingResult {
  success: boolean;
  embedding?: number[];
  error?: string;
  confidence?: number;
}

interface FaceDetectionResult {
  success: boolean;
  faceCropPath?: string;
  faceBBox?: [number, number, number, number];
  confidence?: number;
  error?: string;
}

interface FaceComparisonResult {
  match: boolean;
  distance: number;
  similarity: number;
  confidence: number;
}

interface FaceLivenessResult {
  success: boolean;
  isLive: boolean;
  confidence: number;
  blinkDetected?: boolean;
  headMovementDetected?: boolean;
  antiSpoofScore?: number;
  metrics?: Record<string, any>;
  error?: string;
}

/**
 * Detect and crop face from image
 * Returns cropped face for better embedding quality
 */
export async function detectAndCropFace(imagePath: string, outputDir: string): Promise<FaceDetectionResult> {
  try {
    const outputPath = path.join(outputDir, `face_crop_${Date.now()}.jpg`);
    
    const pythonScript = `
import sys
sys.path.insert(0, '${__dirname}')
from faceProcessing import detect_and_crop_face
import json

result = detect_and_crop_face(r'${imagePath}', r'${outputPath}')
print(json.dumps(result))
`;
    
    const scriptPath = path.join(process.cwd(), `face_detect_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      
      if (result.success && result.face_crop) {
        return {
          success: true,
          faceCropPath: result.face_crop,
          faceBBox: result.face_bbox,
          confidence: result.confidence
        };
      }
      
      return { success: false, error: result.error || "Face detection failed" };
    } catch (e) {
      fs.unlinkSync(scriptPath);
      throw e;
    }
  } catch (error) {
    console.error("Error detecting and cropping face:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Extract 128-D face embedding from image
 * Uses face_recognition library for high-quality embeddings
 */
export async function extractFaceEmbedding(imagePath: string): Promise<FaceEmbeddingResult> {
  try {
    const pythonScript = `
import sys
sys.path.insert(0, '${__dirname}')
from faceProcessing import extract_face_embedding
import json

result = extract_face_embedding(r'${imagePath}')
print(json.dumps(result))
`;
    
    const scriptPath = path.join(process.cwd(), `face_embed_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      
      if (result.success && result.embedding) {
        return {
          success: true,
          embedding: result.embedding,
          confidence: 0.95
        };
      }
      
      return { success: false, error: result.error || "Embedding extraction failed" };
    } catch (e) {
      fs.unlinkSync(scriptPath);
      throw e;
    }
  } catch (error) {
    console.error("Error extracting face embedding:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Compare two face embeddings efficiently
 * Much faster than sequential pixel-by-pixel comparison
 */
export async function compareFaceEmbeddings(
  embedding1: number[],
  embedding2: number[],
  threshold: number = 0.6
): Promise<FaceComparisonResult> {
  try {
    const pythonScript = `
import sys
sys.path.insert(0, '${__dirname}')
from faceProcessing import compare_face_embeddings
import json

emb1 = ${JSON.stringify(embedding1)}
emb2 = ${JSON.stringify(embedding2)}
result = compare_face_embeddings(emb1, emb2, ${threshold})
print(json.dumps(result))
`;
    
    const scriptPath = path.join(process.cwd(), `face_compare_embed_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      
      return {
        match: result.match === true,
        distance: result.distance || 0,
        similarity: result.similarity || 0,
        confidence: result.confidence || 0
      };
    } catch (e) {
      fs.unlinkSync(scriptPath);
      throw e;
    }
  } catch (error) {
    console.error("Error comparing face embeddings:", error);
    return {
      match: false,
      distance: 1.0,
      similarity: 0.0,
      confidence: 0.0
    };
  }
}

/**
 * Comprehensive face liveness detection
 * Combines multiple checks: blink detection, head movement, anti-spoofing
 */
export async function detectFaceLiveness(imagePath: string, previousImagePath?: string): Promise<FaceLivenessResult> {
  try {
    const pythonScript = `
import sys
sys.path.insert(0, '${__dirname}')
from faceProcessing import detect_blink, detect_head_movement, detect_anti_spoofing
import json

blink_result = detect_blink(r'${imagePath}')
movement_result = detect_head_movement(r'${imagePath}')
spoofing_result = detect_anti_spoofing(r'${imagePath}')

# Combine results
combined = {
  "blink": blink_result,
  "movement": movement_result,
  "spoofing": spoofing_result
}

print(json.dumps(combined))
`;
    
    const scriptPath = path.join(process.cwd(), `face_liveness_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      
      // Analyze results
      const blinkScore = result.blink?.success && result.blink?.is_blinking ? 1.0 : 0.5;
      const movementScore = result.movement?.success && result.movement?.is_frontal ? 0.8 : 0.6;
      const spoofingScore = result.spoofing?.success && result.spoofing?.is_real ? result.spoofing?.confidence : 0.3;
      
      // Combined liveness confidence
      const livenessConfidence = (blinkScore * 0.2 + movementScore * 0.3 + spoofingScore * 0.5);
      
      return {
        success: true,
        isLive: livenessConfidence > 0.6,
        confidence: livenessConfidence,
        blinkDetected: result.blink?.is_blinking || false,
        headMovementDetected: result.movement?.success || false,
        antiSpoofScore: spoofingScore,
        metrics: {
          blink: result.blink,
          movement: result.movement,
          spoofing: result.spoofing
        }
      };
    } catch (e) {
      fs.unlinkSync(scriptPath);
      throw e;
    }
  } catch (error) {
    console.error("Error detecting face liveness:", error);
    return {
      success: false,
      isLive: false,
      confidence: 0.0,
      error: String(error)
    };
  }
}

/**
 * Batch face matching against multiple embeddings (efficient 1:N matching)
 * Returns the best match and all scores
 */
export async function findBestFaceMatch(
  queryEmbedding: number[],
  referenceEmbeddings: Array<{ userId: number; embedding: number[] }>,
  threshold: number = 0.6
): Promise<{
  bestMatch: { userId: number; distance: number; similarity: number; confidence: number } | null;
  allMatches: Array<{ userId: number; distance: number; similarity: number; confidence: number }>;
  totalComparisons: number;
}> {
  const allMatches = [];
  let bestMatch = null;
  let bestConfidence = 0;
  
  for (const ref of referenceEmbeddings) {
    const comparison = await compareFaceEmbeddings(queryEmbedding, ref.embedding, threshold);
    
    const matchResult = {
      userId: ref.userId,
      distance: comparison.distance,
      similarity: comparison.similarity,
      confidence: comparison.confidence
    };
    
    allMatches.push(matchResult);
    
    if (comparison.confidence > bestConfidence && comparison.match) {
      bestConfidence = comparison.confidence;
      bestMatch = matchResult;
    }
  }
  
  return {
    bestMatch,
    allMatches: allMatches.sort((a, b) => b.confidence - a.confidence),
    totalComparisons: referenceEmbeddings.length
  };
}

