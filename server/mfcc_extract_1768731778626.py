
import librosa
import numpy as np
import json
import sys

try:
    # Load audio file
    audio_path = r'B:\biometric_security\BioSecure_Login_Copy\server\uploads\ref_converted_1768731771831.wav'
    y, sr = librosa.load(audio_path, sr=16000)
    
    # Extract MFCC features
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    
    # Calculate mean coefficients across time
    mfcc_mean = np.mean(mfcc, axis=1).tolist()
    
    # Output as JSON
    print(json.dumps(mfcc_mean))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
