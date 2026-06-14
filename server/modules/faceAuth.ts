import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

interface FaceAuthResult {
  match: boolean;
  confidence: number;
}

/**
 * Compare two face images using Python and OpenCV
 * Returns match status and confidence score
 */
export async function compareFaces(referencePath: string, loginPath: string): Promise<FaceAuthResult> {
  try {
    // Create a Python script for face comparison
    const pythonScript = `
import cv2
import numpy as np
import json
import sys
from pathlib import Path

try:
    ref_img_path = r'${referencePath}'
    login_img_path = r'${loginPath}'
    
    # Load images
    ref_img = cv2.imread(ref_img_path)
    login_img = cv2.imread(login_img_path)
    
    if ref_img is None or login_img is None:
        print(json.dumps({"match": False, "confidence": 0, "error": "Could not load images"}))
        sys.exit(0)
    
    # Convert to grayscale
    ref_gray = cv2.cvtColor(ref_img, cv2.COLOR_BGR2GRAY)
    login_gray = cv2.cvtColor(login_img, cv2.COLOR_BGR2GRAY)
    
    # Load face detector
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
    
    # Detect faces with optimized parameters for speed
    ref_faces = face_cascade.detectMultiScale(ref_gray, 1.3, 4, minSize=(100, 100))
    login_faces = face_cascade.detectMultiScale(login_gray, 1.3, 4, minSize=(100, 100))
    
    if len(ref_faces) == 0 or len(login_faces) == 0:
        print(json.dumps({"match": False, "confidence": 0, "error": "No faces detected"}))
        sys.exit(0)
    
    # Get the largest face from each image
    ref_face = max(ref_faces, key=lambda f: f[2] * f[3])
    login_face = max(login_faces, key=lambda f: f[2] * f[3])
    
    # Extract face regions
    x, y, w, h = ref_face
    ref_face_roi = ref_gray[y:y+h, x:x+w]
    
    x, y, w, h = login_face
    login_face_roi = login_gray[y:y+h, x:x+w]
    
    # Resize to standard size
    ref_face_roi = cv2.resize(ref_face_roi, (200, 200))
    login_face_roi = cv2.resize(login_face_roi, (200, 200))
    
    # Calculate histogram correlation
    ref_hist = cv2.calcHist([ref_face_roi], [0], None, [256], [0, 256])
    login_hist = cv2.calcHist([login_face_roi], [0], None, [256], [0, 256])
    
    # Normalize histograms
    cv2.normalize(ref_hist, ref_hist, alpha=1, beta=0, norm_type=cv2.NORM_L2)
    cv2.normalize(login_hist, login_hist, alpha=1, beta=0, norm_type=cv2.NORM_L2)
    
    # Compare histograms
    similarity = cv2.compareHist(ref_hist, login_hist, cv2.HISTCMP_CORREL)
    
    # Additional feature matching for robustness
    orb = cv2.ORB_create(nfeatures=500)
    kp1, des1 = orb.detectAndCompute(ref_face_roi, None)
    kp2, des2 = orb.detectAndCompute(login_face_roi, None)
    
    if des1 is not None and des2 is not None:
        # Use BFMatcher
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)
        matches = sorted(matches, key=lambda x: x.distance)
        
        # Calculate feature match score (0-1)
        if len(matches) > 0:
            # Lower distance is better
            feature_score = 1.0 - (np.mean([m.distance for m in matches[:10]]) / 100.0)
            feature_score = max(0, min(1, feature_score))
            
            # Combine histogram and feature scores
            combined_score = 0.6 * similarity + 0.4 * feature_score
        else:
            combined_score = similarity
    else:
        combined_score = similarity
    
    # Determine match (threshold: 0.7)
    match = bool(combined_score > 0.7)
    
    print(json.dumps({"match": match, "confidence": float(min(combined_score, 1.0))}))
    
except Exception as e:
    print(json.dumps({"match": False, "confidence": 0, "error": str(e)}))
`;
    
    // Write script to temporary file
    const scriptPath = path.join(process.cwd(), `face_compare_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      
      // Clean up temporary script
      fs.unlinkSync(scriptPath);
      
      if (result.error) {
        console.error(`Face comparison error: ${result.error}`);
        return { match: false, confidence: 0 };
      }
      
      return {
        match: result.match === true,
        confidence: result.confidence || 0
      };
    } catch (e) {
      fs.unlinkSync(scriptPath);
      console.error("Error running face comparison script:", e);
      return { match: false, confidence: 0 };
    }
  } catch (error) {
    console.error("Error comparing faces:", error);
    return { match: false, confidence: 0 };
  }
}

/**
 * Validate face in image (check if a face exists)
 */
export async function validateFaceExists(imagePath: string): Promise<boolean> {
  try {
    const pythonScript = `
import cv2
import json

try:
    img = cv2.imread(r'${imagePath}')
    if img is None:
        print(json.dumps({"valid": False}))
        exit()
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(100, 100))
    
    print(json.dumps({"valid": len(faces) > 0}))
except:
    print(json.dumps({"valid": False}))
`;
    
    const scriptPath = path.join(process.cwd(), `face_validate_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      return result.valid === true;
    } catch (e) {
      fs.unlinkSync(scriptPath);
      return false;
    }
  } catch (error) {
    console.error(`Error validating face in ${imagePath}:`, error);
    return false;
  }
}

/**
 * Get face quality score (0-1)
 */
export async function getFaceQuality(imagePath: string): Promise<number> {
  try {
    const pythonScript = `
import cv2
import numpy as np
import json

try:
    img = cv2.imread(r'${imagePath}')
    if img is None:
        print(json.dumps({"quality": 0}))
        exit()
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Calculate Laplacian variance (blur detection)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    variance = laplacian.var()
    
    # Normalize to 0-1 (higher variance = better quality)
    quality = min(variance / 500, 1.0)
    
    print(json.dumps({"quality": float(quality)}))
except:
    print(json.dumps({"quality": 0}))
`;
    
    const scriptPath = path.join(process.cwd(), `face_quality_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const { stdout } = await execPromise(`python "${scriptPath}"`);
      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(scriptPath);
      return result.quality || 0;
    } catch (e) {
      fs.unlinkSync(scriptPath);
      return 0;
    }
  } catch (error) {
    console.error(`Error calculating face quality for ${imagePath}:`, error);
    return 0;
  }
}
