#!/usr/bin/env python3
"""
Advanced Voice Processing Module
Provides speaker embedding, challenge-response verification, replay attack detection
"""

import librosa
import numpy as np
import json
import sys
from pathlib import Path
import soundfile as sf
from scipy.spatial.distance import cosine
from scipy.fftpack import fft
import hashlib
from datetime import datetime

def extract_speaker_embedding(audio_path: str, n_mfcc: int = 40) -> dict:
    """
    Extract speaker embedding from audio using MFCC and temporal statistics
    Returns: {success: bool, embedding: list, error: str}
    """
    try:
        # Load audio
        y, sr = librosa.load(audio_path, sr=16000, mono=True)
        
        # Ensure minimum duration (1 second)
        if len(y) / sr < 1.0:
            return {"success": False, "error": "Audio too short (minimum 1 second required)"}
        
        # Extract MFCC features
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
        
        # Extract statistics for each MFCC coefficient
        embedding = []
        for i in range(mfcc.shape[0]):
            # Mean, std, min, max for each coefficient
            embedding.extend([
                float(np.mean(mfcc[i, :])),
                float(np.std(mfcc[i, :])),
                float(np.min(mfcc[i, :])),
                float(np.max(mfcc[i, :]))
            ])
        
        # Additional features: delta (velocity) and delta-delta (acceleration)
        mfcc_delta = librosa.feature.delta(mfcc)
        mfcc_delta2 = librosa.feature.delta(mfcc, order=2)
        
        for i in range(mfcc_delta.shape[0]):
            embedding.extend([
                float(np.mean(mfcc_delta[i, :])),
                float(np.std(mfcc_delta[i, :]))
            ])
        
        # Energy features
        energy = librosa.feature.melspectrogram(y=y, sr=sr)
        energy_db = librosa.power_to_db(energy, ref=np.max)
        embedding.extend([
            float(np.mean(energy_db)),
            float(np.std(energy_db))
        ])
        
        # Spectral centroid
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        embedding.extend([
            float(np.mean(spectral_centroid)),
            float(np.std(spectral_centroid))
        ])
        
        # Pitch contour (fundamental frequency)
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_values = []
        for t in range(pitches.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            if pitch > 0:
                pitch_values.append(float(pitch))
        
        if pitch_values:
            embedding.extend([
                float(np.mean(pitch_values)),
                float(np.std(pitch_values))
            ])
        else:
            embedding.extend([0.0, 0.0])
        
        # Zero crossing rate
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        embedding.extend([
            float(np.mean(zcr)),
            float(np.std(zcr))
        ])
        
        return {
            "success": True,
            "embedding": embedding,
            "dimension": len(embedding),
            "duration": float(len(y) / sr),
            "sample_rate": sr
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


def compare_speaker_embeddings(embedding1: list, embedding2: list, threshold: float = 0.3) -> dict:
    """
    Compare two speaker embeddings using cosine distance
    Returns: {match: bool, distance: float, confidence: float}
    """
    try:
        emb1 = np.array(embedding1)
        emb2 = np.array(embedding2)
        
        if len(emb1) != len(emb2):
            return {"success": False, "error": "Embeddings have different dimensions"}
        
        # Cosine distance (0 = identical, 1 = completely different)
        distance = cosine(emb1, emb2)
        
        # Convert to confidence (higher is more similar)
        confidence = 1.0 - distance
        
        # Determine match (distance < threshold means match)
        match = distance < threshold
        
        return {
            "match": bool(match),
            "distance": float(distance),
            "confidence": float(confidence),
            "threshold": threshold
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


def detect_voice_liveness(audio_path: str) -> dict:
    """
    Detect if voice is live (not replay or synthesis)
    Uses audio characteristics like background noise, natural variation, etc.
    Returns: {success: bool, is_live: bool, confidence: float, metrics: dict}
    """
    try:
        y, sr = librosa.load(audio_path, sr=16000, mono=True)
        
        # Check duration (very short audio is suspicious)
        duration = len(y) / sr
        if duration < 1.0:
            return {
                "success": True,
                "is_live": False,
                "confidence": 0.1,
                "reason": "Audio too short",
                "metrics": {"duration": float(duration)}
            }
        
        # 1. Check for natural frequency variation
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_std = np.std(mfcc, axis=1)
        avg_variation = np.mean(mfcc_std)
        
        # Real speech has good variation (> 0.5)
        # Replayed audio often has less variation
        variation_score = min(avg_variation / 1.0, 1.0)
        
        # 2. Check for background noise (real environments have ambient noise)
        # Very clean audio is suspicious (synthesis or heavily processed)
        stft = librosa.stft(y)
        magnitude = np.abs(stft)
        
        # Check spectral noise floor
        spectral_floor = np.percentile(magnitude, 10)  # Bottom 10%
        noise_presence = float(spectral_floor > np.percentile(magnitude, 1))
        
        # 3. Zero crossing rate variation (natural speech has varied ZCR)
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        zcr_variation = np.std(zcr)
        zcr_score = min(zcr_variation * 5, 1.0)
        
        # 4. Energy variation over time (natural speech has dynamic energy)
        energy = librosa.feature.rms(y=y)[0]
        energy_variation = np.std(energy)
        energy_score = min(energy_variation / 0.1, 1.0)
        
        # 5. Check for artifacts (spectral discontinuities)
        # Real audio is relatively smooth in spectrogram
        spectrogram = librosa.feature.melspectrogram(y=y, sr=sr)
        spec_diff = np.mean(np.abs(np.diff(spectrogram, axis=1)))
        artifact_score = 1.0 - min(spec_diff / 5.0, 1.0)  # Inverted: lower diff = more real
        
        # Combine metrics (weighted average)
        live_score = (
            variation_score * 0.25 +
            noise_presence * 0.15 +
            zcr_score * 0.25 +
            energy_score * 0.25 +
            artifact_score * 0.1
        )
        
        is_live = live_score > 0.5
        
        return {
            "success": True,
            "is_live": bool(is_live),
            "confidence": float(live_score),
            "metrics": {
                "mfcc_variation": float(avg_variation),
                "variation_score": float(variation_score),
                "noise_presence": float(noise_presence),
                "zcr_variation": float(zcr_variation),
                "zcr_score": float(zcr_score),
                "energy_variation": float(energy_variation),
                "energy_score": float(energy_score),
                "spectral_smoothness": float(artifact_score),
                "duration": float(duration)
            }
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


def detect_replay_attack(audio_path: str, reference_hash: str | None = None) -> dict:
    """
    Detect replay attacks (same audio played back)
    Uses audio fingerprinting and content analysis
    Returns: {success: bool, is_replay: bool, confidence: float, audio_hash: str}
    """
    try:
        y, sr = librosa.load(audio_path, sr=16000, mono=True)
        
        # Create audio fingerprint using spectral characteristics
        stft = librosa.stft(y, n_fft=2048, hop_length=512)
        magnitude = np.abs(stft)
        
        # Extract chroma features (music-like structures would indicate synthesis)
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        
        # Compute hash of normalized spectrogram
        normalized_spec = magnitude / (np.max(magnitude) + 1e-10)
        spec_hash = hashlib.md5(normalized_spec.tobytes()).hexdigest()
        
        # Check for exact match (perfect replay)
        exact_replay = (spec_hash == reference_hash) if reference_hash else False
        
        # Additional checks for replay characteristics
        # Replayed audio often has slight artifacts, compression, or echo
        
        # Check for slight temporal distortion
        y_stretched = librosa.effects.time_stretch(y, rate=1.01)
        y_original = librosa.effects.time_stretch(y, rate=1.0)
        
        # Detect silence patterns (natural speech vs. played audio)
        intervals = librosa.effects.split(y, top_db=20, ref=np.max)
        if len(intervals) > 5:  # More breaks = possibly played
            break_score = 0.7
        elif len(intervals) > 3:
            break_score = 0.4
        else:
            break_score = 0.1
        
        # Spectral consistency (replayed audio often has smoother spectra)
        spec_entropy = -np.sum(normalized_spec * np.log(normalized_spec + 1e-10), axis=0)
        entropy_variance = np.std(spec_entropy)
        entropy_score = min(entropy_variance / 2.0, 1.0)  # Higher variance = more real
        
        replay_score = (break_score * 0.4 + (1.0 - entropy_score) * 0.6)
        
        is_replay = exact_replay or replay_score > 0.6
        
        return {
            "success": True,
            "is_replay": bool(is_replay),
            "confidence": float(replay_score) if not exact_replay else 1.0,
            "audio_hash": spec_hash,
            "exact_match": bool(exact_replay),
            "metrics": {
                "break_score": float(break_score),
                "entropy_score": float(entropy_score),
                "num_silence_breaks": len(intervals)
            }
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


def verify_phrase_match(audio_path: str, expected_phrase: str, sr: int = 16000) -> dict:
    """
    Simple phrase verification using speech recognition (if available)
    This is a placeholder - in production use Google Speech Recognition or similar
    Returns: {success: bool, phrase_matched: bool, confidence: float}
    """
    try:
        y, sr_loaded = librosa.load(audio_path, sr=sr, mono=True)
        
        # Simple heuristic: check audio duration and energy
        # Expected phrases of 2-5 words: ~1-3 seconds
        # Single word or very long audio is suspicious
        
        duration = len(y) / sr_loaded
        
        # Check if duration is reasonable for a phrase (adjust based on phrase length)
        # Rough heuristic: ~0.5 seconds per word
        min_duration = 0.5  # Minimum
        max_duration = 10.0  # Maximum
        
        duration_ok = min_duration <= duration <= max_duration
        
        # Check for speech energy (not silent)
        energy = librosa.feature.rms(y=y)
        energy_threshold = np.max(energy) * 0.1
        speech_frames = np.sum(energy > energy_threshold)
        speech_ratio = speech_frames / len(energy) if len(energy) > 0 else 0
        
        # Speech should occupy at least 30% of audio
        energy_ok = speech_ratio > 0.3
        
        phrase_matched = duration_ok and energy_ok
        confidence = 0.6 if phrase_matched else 0.2
        
        return {
            "success": True,
            "phrase_matched": bool(phrase_matched),
            "confidence": float(confidence),
            "metrics": {
                "duration": float(duration),
                "duration_valid": bool(duration_ok),
                "speech_ratio": float(speech_ratio),
                "energy_valid": bool(energy_ok)
            }
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "embedding" and len(sys.argv) > 2:
            result = extract_speaker_embedding(sys.argv[2])
            print(json.dumps(result))
        
        elif command == "compare" and len(sys.argv) > 3:
            emb1 = json.loads(sys.argv[2])
            emb2 = json.loads(sys.argv[3])
            result = compare_speaker_embeddings(emb1, emb2)
            print(json.dumps(result))
        
        elif command == "liveness" and len(sys.argv) > 2:
            result = detect_voice_liveness(sys.argv[2])
            print(json.dumps(result))
        
        elif command == "replay" and len(sys.argv) > 2:
            ref_hash = sys.argv[3] if len(sys.argv) > 3 else None
            result = detect_replay_attack(sys.argv[2], ref_hash)
            print(json.dumps(result))
        
        elif command == "phrase" and len(sys.argv) > 3:
            result = verify_phrase_match(sys.argv[2], sys.argv[3])
            print(json.dumps(result))
