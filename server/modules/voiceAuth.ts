import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

interface VoiceAuthResult {
  match: boolean;
  confidence: number;
}

interface MFCCFeatures {
  features: number[][];
  sampleRate: number;
}

async function extractMFCCFeatures(audioPath: string): Promise<number[] | null> {
  try {
    // Create a Python script to extract MFCC features (optimized)
    const pythonScript = `
import librosa
import numpy as np
import json
import sys

try:
    # Load audio file with faster processing
    audio_path = r'${audioPath}'
    y, sr = librosa.load(audio_path, sr=16000, mono=True)
    
    # Extract fewer MFCC coefficients for faster processing (13 -> 10)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=10)
    
    # Calculate mean coefficients across time
    mfcc_mean = np.mean(mfcc, axis=1).tolist()
    
    # Output as JSON
    print(json.dumps(mfcc_mean))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;
    
    // Write script to temporary file
    const scriptPath = path.join(process.cwd(), `mfcc_extract_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const features = JSON.parse(stdout.trim());
      
      if (Array.isArray(features)) {
        return features;
      } else if (features.error) {
        console.error(`MFCC extraction error: ${features.error}`);
        return null;
      }
      return null;
    } finally {
      // Clean up temporary script
      fs.unlinkSync(scriptPath);
    }
  } catch (error) {
    console.error(`Error extracting MFCC features from ${audioPath}:`, error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two feature vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Convert WebM audio to WAV format for processing (optimized with silent flags)
 */
async function convertAudioFormat(inputPath: string, outputPath: string): Promise<boolean> {
  try {
    // Use ffmpeg with quiet flags for faster processing
    const command = `ffmpeg -hide_banner -loglevel error -i "${inputPath}" -acodec pcm_s16le -ar 16000 "${outputPath}" -y`;
    await execPromise(command);
    return true;
  } catch (error) {
    console.error(`Error converting audio format: ${error}`);
    return false;
  }
}

/**
 * Extract audio features and compare (optimized with parallel processing)
 */
export async function compareVoices(referencePath: string, loginPath: string): Promise<VoiceAuthResult> {
  try {
    // Convert audio files in PARALLEL instead of sequentially
    const uploadDir = path.join(process.cwd(), "uploads");
    const refConverted = path.join(uploadDir, `ref_converted_${Date.now()}.wav`);
    const loginConverted = path.join(uploadDir, `login_converted_${Date.now()}.wav`);
    
    // Run both conversions simultaneously
    const [refConverted_Success, loginConverted_Success] = await Promise.all([
      convertAudioFormat(referencePath, refConverted),
      convertAudioFormat(loginPath, loginConverted)
    ]);
    
    if (!refConverted_Success || !loginConverted_Success) {
      console.error("Failed to convert audio formats");
      return { match: false, confidence: 0 };
    }
    
    // Extract MFCC features in PARALLEL
    const [refFeatures, loginFeatures] = await Promise.all([
      extractMFCCFeatures(refConverted),
      extractMFCCFeatures(loginConverted)
    ]);
    
    // Clean up converted files
    try {
      fs.unlinkSync(refConverted);
      fs.unlinkSync(loginConverted);
    } catch (e) {
      console.warn("Could not clean up temporary audio files");
    }
    
    if (!refFeatures || !loginFeatures) {
      console.error("Could not extract MFCC features from one or both audio files");
      return { match: false, confidence: 0 };
    }
    
    // Calculate similarity
    const similarity = cosineSimilarity(refFeatures, loginFeatures);
    
    // Threshold for voice match (0.75+ is considered a good match)
    const match = similarity > 0.75;
    
    return {
      match,
      confidence: Math.max(0, Math.min(similarity, 1.0))
    };
  } catch (error) {
    console.error("Error comparing voices:", error);
    return { match: false, confidence: 0 };
  }
}

/**
 * Validate voice in audio file (check if audio has sufficient energy)
 */
export async function validateVoiceExists(audioPath: string): Promise<boolean> {
  try {
    // Use Python to check audio properties
    const pythonScript = `
import librosa
import numpy as np
import json

try:
    audio_path = r'${audioPath}'
    y, sr = librosa.load(audio_path, sr=16000)
    
    # Calculate RMS energy
    rms = librosa.feature.rms(y=y)[0]
    mean_energy = np.mean(rms)
    
    # Audio is valid if it has sufficient energy
    is_valid = mean_energy > 0.01
    
    print(json.dumps({"valid": is_valid, "energy": float(mean_energy)}))
except Exception as e:
    print(json.dumps({"valid": False, "error": str(e)}))
`;
    
    const scriptPath = path.join(process.cwd(), `voice_validate_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      
      // Clean up
      fs.unlinkSync(scriptPath);
      
      return result.valid === true;
    } catch (e) {
      fs.unlinkSync(scriptPath);
      return false;
    }
  } catch (error) {
    console.error(`Error validating voice in ${audioPath}:`, error);
    return false;
  }
}

/**
 * Get audio quality score (0-1) based on SNR estimation
 */
export async function getAudioQuality(audioPath: string): Promise<number> {
  try {
    const pythonScript = `
import librosa
import numpy as np
import json

try:
    audio_path = r'${audioPath}'
    y, sr = librosa.load(audio_path, sr=16000)
    
    # Calculate spectral centroid as a quality metric
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    
    # Calculate RMS energy
    rms = librosa.feature.rms(y=y)[0]
    
    # Quality score based on energy and spectral properties
    mean_energy = np.mean(rms)
    energy_score = min(mean_energy / 0.1, 1.0)  # Normalize to 0-1
    
    quality = max(0, min(energy_score * 0.8 + 0.2, 1.0))
    
    print(json.dumps({"quality": float(quality)}))
except Exception as e:
    print(json.dumps({"quality": 0.0, "error": str(e)}))
`;
    
    const scriptPath = path.join(process.cwd(), `audio_quality_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      
      // Clean up
      fs.unlinkSync(scriptPath);
      
      return result.quality || 0;
    } catch (e) {
      fs.unlinkSync(scriptPath);
      return 0;
    }
  } catch (error) {
    console.error(`Error calculating audio quality for ${audioPath}:`, error);
    return 0;
  }
}
