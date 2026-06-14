"""
Advanced Face Recognition with Embeddings Pipeline
Optimized for accuracy, speed, and scalability

Uses:
- face_recognition library (face_encodings for embeddings)
- OpenCV for face detection and ROI extraction
- NumPy for embedding comparison
- FAISS for large-scale matching (optional)
"""

import cv2
import numpy as np
import json
import sys
import face_recognition
from pathlib import Path
from typing import Tuple, List, Dict, Optional

# Constants
FACE_ENCODING_MODEL = "hog"  # "hog" for speed, "cnn" for accuracy (requires GPU)
EMBEDDING_DIMENSION = 128  # face_recognition outputs 128-D vectors
AUTHENTICATION_THRESHOLD = 0.6  # Distance threshold for authentication (0.6 is default)
REGISTRATION_THRESHOLD = 0.5  # Stricter threshold for registration quality

class FaceEmbeddingPipeline:
    """Production-grade face embedding extraction and matching"""
    
    @staticmethod
    def extract_face_roi(image_path: str) -> Tuple[Optional[np.ndarray], Dict]:
        """
        Extract only the face region of interest (ROI) from image.
        
        Args:
            image_path: Path to image file
            
        Returns:
            Tuple of (cropped_face_rgb, metadata_dict)
            metadata includes: face_bbox, face_size, confidence, original_shape
        """
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                return None, {"error": "Could not load image", "face_found": False}
            
            # Convert BGR to RGB for face_recognition
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Detect faces using dlib (via face_recognition library)
            # Returns list of [top, right, bottom, left] coordinates
            face_locations = face_recognition.face_locations(rgb_image, model=FACE_ENCODING_MODEL)
            
            if not face_locations:
                return None, {"error": "No face detected", "face_found": False}
            
            # Get the largest face (most likely the primary subject)
            face_bbox = max(face_locations, key=lambda b: (b[2]-b[0]) * (b[1]-b[3]))
            top, right, bottom, left = face_bbox
            
            # Extract ROI with small padding for better embeddings
            padding = 10
            h, w = rgb_image.shape[:2]
            top = max(0, top - padding)
            left = max(0, left - padding)
            bottom = min(h, bottom + padding)
            right = min(w, right + padding)
            
            face_roi = rgb_image[top:bottom, left:right]
            
            # Validate face region size (must be reasonable)
            face_height = bottom - top
            face_width = right - left
            
            metadata = {
                "face_found": True,
                "face_bbox": {"top": top, "right": right, "bottom": bottom, "left": left},
                "face_size": {"height": face_height, "width": face_width},
                "original_shape": rgb_image.shape,
                "num_faces_detected": len(face_locations)
            }
            
            return face_roi, metadata
            
        except Exception as e:
            return None, {"error": str(e), "face_found": False}
    
    @staticmethod
    def extract_embedding(image_path: str) -> Tuple[Optional[np.ndarray], Dict]:
        """
        Extract face embedding (128-D vector) from image.
        Only the face ROI is used (not full frame).
        
        Args:
            image_path: Path to image file
            
        Returns:
            Tuple of (embedding_vector, metadata_dict)
            embedding is 128-D NumPy array, None if face not found
        """
        try:
            # Extract face ROI
            face_roi, roi_metadata = FaceEmbeddingPipeline.extract_face_roi(image_path)
            
            if face_roi is None:
                return None, roi_metadata
            
            # Generate embedding (128-D vector)
            encodings = face_recognition.face_encodings(face_roi, model="large")
            
            if not encodings:
                return None, {**roi_metadata, "error": "Could not generate embedding", "embedding_generated": False}
            
            embedding = encodings[0]  # Use first encoding
            
            metadata = {
                **roi_metadata,
                "embedding_generated": True,
                "embedding_dimension": len(embedding),
            }
            
            return embedding, metadata
            
        except Exception as e:
            return None, {"error": str(e), "embedding_generated": False}
    
    @staticmethod
    def compare_embeddings(ref_embedding: np.ndarray, test_embedding: np.ndarray) -> Dict:
        """
        Compare two embeddings using Euclidean distance.
        Lower distance = more similar faces.
        
        Args:
            ref_embedding: Reference embedding (128-D)
            test_embedding: Test embedding (128-D)
            
        Returns:
            Dict with distance, match status, confidence
        """
        try:
            # Calculate Euclidean distance
            distance = np.linalg.norm(ref_embedding - test_embedding)
            
            # Convert distance to confidence (lower distance = higher confidence)
            # Distance 0.0 = perfect match
            # Distance > 1.0 = no match
            confidence = max(0, 1.0 - distance)
            
            # Determine match based on threshold
            match = distance < AUTHENTICATION_THRESHOLD
            
            return {
                "distance": float(distance),
                "confidence": float(confidence),
                "match": match,
                "threshold": AUTHENTICATION_THRESHOLD
            }
        except Exception as e:
            return {
                "error": str(e),
                "distance": float('inf'),
                "confidence": 0.0,
                "match": False
            }
    
    @staticmethod
    def compare_embeddings_batch(ref_embedding: np.ndarray, test_embeddings: List[np.ndarray]) -> Dict:
        """
        Compare one reference embedding against multiple test embeddings.
        Optimized for fast batch comparison.
        
        Args:
            ref_embedding: Reference embedding (128-D)
            test_embeddings: List of test embeddings (each 128-D)
            
        Returns:
            Dict with best match, distance array, indices
        """
        try:
            distances = face_recognition.face_distance(
                [ref_embedding], 
                np.array(test_embeddings)
            )[0]  # Returns (1, N) array, get first row
            
            best_idx = np.argmin(distances)
            best_distance = distances[best_idx]
            best_confidence = max(0, 1.0 - best_distance)
            best_match = best_distance < AUTHENTICATION_THRESHOLD
            
            return {
                "best_match_index": int(best_idx),
                "best_distance": float(best_distance),
                "best_confidence": float(best_confidence),
                "match": best_match,
                "all_distances": distances.tolist(),
                "threshold": AUTHENTICATION_THRESHOLD
            }
        except Exception as e:
            return {
                "error": str(e),
                "match": False,
                "best_match_index": -1
            }


def main():
    """CLI interface for embedding extraction"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python faceEmbeddings.py <command> <args>"}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "extract_roi":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Usage: extract_roi <image_path>"}))
            sys.exit(1)
        
        image_path = sys.argv[2]
        face_roi, metadata = FaceEmbeddingPipeline.extract_face_roi(image_path)
        
        if face_roi is not None and metadata.get("face_found"):
            # Save ROI to file
            roi_output_path = image_path.replace(".", "_roi.")
            cv2.imwrite(roi_output_path, cv2.cvtColor(face_roi, cv2.COLOR_RGB2BGR))
            metadata["roi_saved_to"] = roi_output_path
        
        print(json.dumps(metadata))
    
    elif command == "extract_embedding":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Usage: extract_embedding <image_path>"}))
            sys.exit(1)
        
        image_path = sys.argv[2]
        embedding, metadata = FaceEmbeddingPipeline.extract_embedding(image_path)
        
        if embedding is not None:
            metadata["embedding"] = embedding.tolist()
        
        print(json.dumps(metadata, default=str))
    
    elif command == "compare":
        if len(sys.argv) < 4:
            print(json.dumps({"error": "Usage: compare <ref_image_path> <test_image_path>"}))
            sys.exit(1)
        
        ref_image_path = sys.argv[2]
        test_image_path = sys.argv[3]
        
        ref_embedding, ref_metadata = FaceEmbeddingPipeline.extract_embedding(ref_image_path)
        test_embedding, test_metadata = FaceEmbeddingPipeline.extract_embedding(test_image_path)
        
        if ref_embedding is not None and test_embedding is not None:
            comparison = FaceEmbeddingPipeline.compare_embeddings(ref_embedding, test_embedding)
            print(json.dumps(comparison))
        else:
            print(json.dumps({
                "error": "Could not extract embeddings",
                "ref_ok": ref_embedding is not None,
                "test_ok": test_embedding is not None
            }))
    
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
