#!/usr/bin/env python3
"""
Advanced Face Processing Module
Provides face detection, cropping, embedding extraction, liveness detection, and anti-spoofing
"""

import cv2
import dlib
import face_recognition
import numpy as np
import json
import sys
from pathlib import Path
import imutils
from scipy import stats

# Initialize dlib predictor for face landmarks
try:
    # This file should be in the same directory
    predictor_path = Path(__file__).parent / "shape_predictor_68_face_landmarks.dat"
    if not predictor_path.exists():
        # Try alternative path
        predictor_path = Path.cwd() / "shape_predictor_68_face_landmarks.dat"
    
    if predictor_path.exists():
        predictor = dlib.shape_predictor(str(predictor_path))
    else:
        predictor = None
        print(json.dumps({
            "error": "Dlib predictor not found. Run setup to download shape_predictor_68_face_landmarks.dat",
            "warning": True
        }), file=sys.stderr)
except Exception as e:
    predictor = None
    print(json.dumps({"error": f"Failed to load dlib predictor: {str(e)}", "warning": True}), file=sys.stderr)

detector = dlib.get_frontalface_detector()


def detect_and_crop_face(image_path: str, output_path: str | None = None) -> dict:
    """
    Detect face in image and crop it
    Returns: {success: bool, face_crop_path: str, face_bbox: [x, y, w, h], confidence: float}
    """
    try:
        img = cv2.imread(image_path)
        if img is None:
            return {"success": False, "error": "Could not load image"}
        
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Detect faces using dlib (more reliable than cascade)
        faces = detector(rgb, 1)
        
        if len(faces) == 0:
            return {"success": False, "error": "No face detected"}
        
        if len(faces) > 1:
            # Multiple faces - use the largest one
            face = max(faces, key=lambda f: f.width() * f.height())
            confidence = 0.8  # Lower confidence for multiple faces
        else:
            face = faces[0]
            confidence = 0.95
        
        # Convert dlib rect to OpenCV coordinates
        x, y, w, h = face.left(), face.top(), face.width(), face.height()
        
        # Add padding around face (10%)
        padding = int(min(w, h) * 0.1)
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(img.shape[1] - x, w + 2 * padding)
        h = min(img.shape[0] - y, h + 2 * padding)
        
        # Crop face region
        face_crop = img[y:y+h, x:x+w]
        
        # Save cropped face if output path provided
        face_crop_path = None
        if output_path:
            cv2.imwrite(output_path, face_crop)
            face_crop_path = output_path
        
        return {
            "success": True,
            "face_crop": face_crop_path or image_path,
            "face_bbox": [int(x), int(y), int(w), int(h)],
            "confidence": float(confidence),
            "width": int(w),
            "height": int(h)
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


def extract_face_embedding(image_path: str) -> dict:
    """
    Extract 128-dimensional face embedding using face_recognition library
    Returns: {success: bool, embedding: [128 floats], error: str}
    """
    try:
        image = face_recognition.load_image_file(image_path)
        face_encodings = face_recognition.face_encodings(image)
        
        if len(face_encodings) == 0:
            return {"success": False, "error": "No face found for embedding"}
        
        # Use the first face
        embedding = face_encodings[0].tolist()
        
        return {
            "success": True,
            "embedding": embedding,
            "dimension": 128
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


def compare_face_embeddings(embedding1: list, embedding2: list, threshold: float = 0.6) -> dict:
    """
    Compare two face embeddings using Euclidean distance
    Returns: {match: bool, distance: float, confidence: float}
    """
    try:
        emb1 = np.array(embedding1)
        emb2 = np.array(embedding2)
        
        # Euclidean distance
        distance = np.linalg.norm(emb1 - emb2)
        
        # Convert distance to similarity score (0-1)
        # Smaller distance = higher similarity
        # Typical range is 0.0 to ~0.7 for different faces
        similarity = 1.0 / (1.0 + distance)
        
        # Determine match
        match = distance < threshold
        
        return {
            "match": bool(match),
            "distance": float(distance),
            "similarity": float(similarity),
            "confidence": float(min(1.0, 1.0 - distance / threshold)) if distance < 1.5 else 0.0
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


def detect_blink(image_path: str) -> dict:
    """
    Detect eye blink by analyzing landmarks
    Returns: {success: bool, is_blinking: bool, eye_aspect_ratio: float}
    """
    if predictor is None:
        return {"success": False, "error": "Dlib predictor not available"}
    
    try:
        img = cv2.imread(image_path)
        if img is None:
            return {"success": False, "error": "Could not load image"}
        
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        faces = detector(rgb, 1)
        
        if len(faces) == 0:
            return {"success": False, "error": "No face detected"}
        
        face = faces[0]
        landmarks = predictor(rgb, face)
        
        # Extract eye coordinates (landmarks 36-41 for left eye, 42-47 for right eye)
        left_eye = np.array([[landmarks.part(i).x, landmarks.part(i).y] for i in range(36, 42)])
        right_eye = np.array([[landmarks.part(i).x, landmarks.part(i).y] for i in range(42, 48)])
        
        # Calculate eye aspect ratio
        def eye_aspect_ratio(eye):
            A = np.linalg.norm(eye[1] - eye[5])
            B = np.linalg.norm(eye[2] - eye[4])
            C = np.linalg.norm(eye[0] - eye[3])
            return (A + B) / (2.0 * C)
        
        left_ear = eye_aspect_ratio(left_eye)
        right_ear = eye_aspect_ratio(right_eye)
        avg_ear = (left_ear + right_ear) / 2.0
        
        # Typical threshold for blink is around 0.2
        is_blinking = avg_ear < 0.25
        
        return {
            "success": True,
            "is_blinking": bool(is_blinking),
            "left_eye_aspect_ratio": float(left_ear),
            "right_eye_aspect_ratio": float(right_ear),
            "average_aspect_ratio": float(avg_ear),
            "blink_threshold": 0.25
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


def detect_head_movement(image_path: str, reference_landmarks: list | None = None) -> dict:
    """
    Detect head pose using landmarks
    Returns: {success: bool, yaw: float, pitch: float, roll: float}
    """
    if predictor is None:
        return {"success": False, "error": "Dlib predictor not available"}
    
    try:
        img = cv2.imread(image_path)
        if img is None:
            return {"success": False, "error": "Could not load image"}
        
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        faces = detector(rgb, 1)
        
        if len(faces) == 0:
            return {"success": False, "error": "No face detected"}
        
        face = faces[0]
        landmarks = predictor(rgb, face)
        
        # Get key facial points for pose estimation
        # Using landmarks 36-67 (eyes, nose, mouth, chin)
        points_2d = np.float32([[landmarks.part(i).x, landmarks.part(i).y] for i in range(36, 68)])
        
        # 3D face model points (approximate)
        size = img.shape
        focal_length = size[1]
        center = (size[1] / 2, size[0] / 2)
        camera_matrix = np.array(
            [[focal_length, 0, center[0]],
             [0, focal_length, center[1]],
             [0, 0, 1]], dtype="double"
        )
        
        dist_coeffs = np.zeros((4, 1))
        
        # Simple pose estimation based on landmark positions
        # Calculate yaw based on horizontal deviation of face center
        face_center_x = (landmarks.part(36).x + landmarks.part(45).x) / 2
        face_center_y = (landmarks.part(36).y + landmarks.part(45).y) / 2
        image_center_x = img.shape[1] / 2
        
        yaw = (face_center_x - image_center_x) / (img.shape[1] / 2) * 30  # ±30 degrees
        
        # Calculate pitch based on vertical deviation
        nose_tip = landmarks.part(30)
        chin = landmarks.part(8)
        nose_chin_distance = np.sqrt((nose_tip.x - chin.x)**2 + (nose_tip.y - chin.y)**2)
        pitch = (nose_chin_distance - 50) / 100 * 30  # Approximate
        
        return {
            "success": True,
            "yaw": float(yaw),
            "pitch": float(pitch),
            "roll": 0.0,
            "is_frontal": abs(float(yaw)) < 25 and abs(float(pitch)) < 25
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


def detect_anti_spoofing(image_path: str) -> dict:
    """
    Detect spoofing (photo/video attacks) using texture and frequency analysis
    Returns: {success: bool, is_real: bool, confidence: float, metrics: dict}
    """
    try:
        img = cv2.imread(image_path)
        if img is None:
            return {"success": False, "error": "Could not load image"}
        
        # Face detection first
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        faces = detector(rgb, 1)
        
        if len(faces) == 0:
            return {"success": False, "error": "No face detected"}
        
        face = faces[0]
        x, y, w, h = face.left(), face.top(), face.width(), face.height()
        face_region = img[y:y+h, x:x+w]
        
        # Convert to grayscale
        gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
        
        # 1. Laplacian variance (blur detection - photos are often blurry)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        laplacian_variance = laplacian.var()
        
        # 2. LBP (Local Binary Pattern) - texture feature
        # Compute LBP histogram
        lbp = np.zeros_like(gray, dtype=np.uint8)
        for i in range(1, gray.shape[0] - 1):
            for j in range(1, gray.shape[1] - 1):
                center = gray[i, j]
                neighbors = [
                    gray[i-1, j-1], gray[i-1, j], gray[i-1, j+1],
                    gray[i, j+1], gray[i+1, j+1], gray[i+1, j],
                    gray[i+1, j-1], gray[i, j-1]
                ]
                lbp_value = 0
                for k, neighbor in enumerate(neighbors):
                    if neighbor >= center:
                        lbp_value += 2**k
                lbp[i, j] = lbp_value
        
        lbp_entropy = stats.entropy(cv2.calcHist([lbp], [0], None, [256], [0, 256]).flatten())
        
        # 3. Frequency domain analysis (DCT)
        dct_matrix = cv2.dct(np.float32(gray) / 255.0)
        dct_energy = np.sum(dct_matrix ** 2)
        
        # 4. Edge detection - real faces have more edges than photos
        edges = cv2.Canny(gray, 50, 150)
        edge_density = cv2.countNonZero(edges) / edges.size
        
        # Heuristic scoring
        # Real face indicators:
        # - Higher Laplacian variance (not blurry)
        # - Higher LBP entropy (complex texture)
        # - Moderate DCT energy
        # - Higher edge density
        
        laplacian_score = min(laplacian_variance / 500, 1.0)  # Normalize
        entropy_score = min(lbp_entropy / 7.0, 1.0)
        edge_score = min(edge_density * 10, 1.0)
        
        # Weighted combination
        spoofing_score = (laplacian_score * 0.3 + entropy_score * 0.4 + edge_score * 0.3)
        
        # Threshold: > 0.5 is considered real
        is_real = spoofing_score > 0.5
        
        return {
            "success": True,
            "is_real": bool(is_real),
            "confidence": float(spoofing_score),
            "metrics": {
                "laplacian_variance": float(laplacian_variance),
                "lbp_entropy": float(lbp_entropy),
                "dct_energy": float(dct_energy),
                "edge_density": float(edge_density),
                "laplacian_score": float(laplacian_score),
                "entropy_score": float(entropy_score),
                "edge_score": float(edge_score)
            }
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    # Test functions
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "crop" and len(sys.argv) > 3:
            result = detect_and_crop_face(sys.argv[2], sys.argv[3])
            print(json.dumps(result))
        
        elif command == "embedding" and len(sys.argv) > 2:
            result = extract_face_embedding(sys.argv[2])
            print(json.dumps(result))
        
        elif command == "compare" and len(sys.argv) > 3:
            emb1 = json.loads(sys.argv[2])
            emb2 = json.loads(sys.argv[3])
            result = compare_face_embeddings(emb1, emb2)
            print(json.dumps(result))
        
        elif command == "blink" and len(sys.argv) > 2:
            result = detect_blink(sys.argv[2])
            print(json.dumps(result))
        
        elif command == "head" and len(sys.argv) > 2:
            result = detect_head_movement(sys.argv[2])
            print(json.dumps(result))
        
        elif command == "spoofing" and len(sys.argv) > 2:
            result = detect_anti_spoofing(sys.argv[2])
            print(json.dumps(result))
