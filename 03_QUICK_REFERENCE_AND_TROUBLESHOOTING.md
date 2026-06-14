# BioSecure - Quick Reference & Troubleshooting Guide

**Last Updated**: January 22, 2026  
**Version**: 2.0  
**Audience**: End Users & Quick Lookup

---

## Table of Contents
1. [Quick Command Reference](#quick-command-reference)
2. [API Endpoint Summary](#api-endpoint-summary)
3. [Configuration Quick Reference](#configuration-quick-reference)
4. [Common Issues & Solutions](#common-issues--solutions)
5. [Face Embeddings Quick Reference](#face-embeddings-quick-reference)
6. [Environment Setup Checklist](#environment-setup-checklist)
7. [Troubleshooting Matrix](#troubleshooting-matrix)
8. [Performance Diagnostics](#performance-diagnostics)

---

## Quick Command Reference

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/BioSecure.git
cd BioSecure_offline_Copy

# 2. Install dependencies
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# 3. Python setup
pip install -r requirements.txt

# 4. Database setup
npm run db:push

# 5. Run development
npm run dev
```

### Development Commands

| Command | Purpose | Location |
|---------|---------|----------|
| `npm run dev` | Start dev server + client | Root |
| `npm run build` | Build for production | Root |
| `npm run db:push` | Push schema to DB | Server |
| `npm run db:generate` | Generate migration | Server |
| `npm run client:dev` | Client only | Root |
| `npm run server:dev` | Server only | Root |

### Database Commands

```bash
# Drizzle ORM commands
cd server
drizzle-kit push:pg              # Push schema to DB
drizzle-kit generate:pg          # Generate migrations
drizzle-kit studio              # Open visual DB editor (localhost:16500)
drizzle-kit introspect:pg       # Sync existing DB
```

### Python Commands

```bash
# Python environment setup
python -m venv venv
source venv/bin/activate        # Linux/macOS
# OR
venv\Scripts\activate           # Windows

# Face embedding extraction
python -c "
import face_recognition
image = face_recognition.load_image_file('face.jpg')
encodings = face_recognition.face_encodings(image)
print(f'Embedding: {encodings[0]}')
"

# Voice MFCC extraction
python -c "
import librosa
import numpy as np
y, sr = librosa.load('voice.wav', sr=16000)
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=10)
print(f'MFCC: {np.mean(mfcc, axis=1)}')
"
```

### File Operations

```bash
# Delete user uploads
rm uploads/face_*.jpg
rm uploads/voice_*.webm
rm uploads/login_*.jpg
rm uploads/login_*.webm

# Backup database
pg_dump -U postgres biosecure > backup.sql

# Restore database
psql -U postgres < backup.sql
```

---

## API Endpoint Summary

### POST /api/auth/register

**Purpose:** Register new user with face and voice

**Request:**
```json
{
  "displayName": "John Doe",
  "faceImage": "data:image/jpeg;base64,...",
  "voiceAudio": "data:audio/webm;base64,..."
}
```

**Success Response (201):**
```json
{
  "id": 1,
  "displayName": "John Doe",
  "faceImagePath": "face_1234567890.jpg",
  "voiceAudioPath": "voice_1234567890.webm",
  "createdAt": "2024-01-22T10:30:00Z"
}
```

**Error Responses:**
```json
// 400 - Validation failed
{ "error": "Display name must be at least 2 characters" }

// 409 - User exists
{ "error": "User already registered" }

// 500 - Server error
{ "error": "Failed to process biometric data" }
```

### POST /api/auth/login

**Purpose:** Authenticate user with face and voice

**Request:**
```json
{
  "faceImage": "data:image/jpeg;base64,...",
  "voiceAudio": "data:audio/webm;base64,..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "displayName": "John Doe",
    "createdAt": "2024-01-22T10:30:00Z"
  },
  "matchDetails": {
    "faceMatch": true,
    "voiceMatch": true,
    "confidence": 0.87
  }
}
```

**Error Responses:**
```json
// 401 - Face not recognized
{ "error": "Face not recognized", "code": "FACE_MISMATCH" }

// 401 - Voice failed
{ "error": "Voice verification failed", "code": "VOICE_MISMATCH" }

// 429 - Too many attempts
{ "error": "Too many attempts. Try again in 5 minutes." }
```

### GET /api/auth/status

**Purpose:** Check authentication status

**Response (200):**
```json
{
  "authenticated": true,
  "user": { "id": 1, "displayName": "John Doe" }
}
```

---

## Configuration Quick Reference

### Environment Variables (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/biosecure

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Upload settings
MAX_UPLOAD_SIZE=50mb
UPLOADS_DIR=./uploads

# Biometric thresholds
FACE_CONFIDENCE_THRESHOLD=0.7
VOICE_CONFIDENCE_THRESHOLD=0.75
LIVENESS_THRESHOLD=0.5

# Rate limiting
MAX_AUTH_ATTEMPTS=5
AUTH_ATTEMPT_WINDOW=300000

# JWT (optional)
JWT_SECRET=your_secret_key
JWT_EXPIRY=24h
```

### Client Configuration (Vite)

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000'  // Proxy to backend
    },
    cors: true
  }
})
```

### Server Configuration (Express)

**server/index.ts:**
```typescript
const PORT = process.env.PORT || 3000;
const MAX_PAYLOAD = process.env.MAX_UPLOAD_SIZE || '50mb';

app.use(express.json({ limit: MAX_PAYLOAD }));
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

### Database Configuration (Drizzle)

**drizzle.config.ts:**
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
});
```

---

## Common Issues & Solutions

### 1. Camera Permission Denied

**Symptom:** "Camera permission denied" error

**Solutions:**
1. Allow camera access:
   - Chrome: Click camera icon → Allow
   - Firefox: Click permission prompt → Allow
   - Safari: Settings → Privacy → Camera → Allow

2. Check HTTPS (required in production):
   ```typescript
   // Development: HTTP OK
   // Production: HTTPS required
   ```

3. Check browser compatibility:
   - ✅ Chrome 54+
   - ✅ Firefox 55+
   - ✅ Safari 15+
   - ✅ Edge 79+

**Code:**
```typescript
// client/components/BiometricCamera.tsx
const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    videoRef.current.srcObject = stream;
  } catch (error) {
    if (error.name === "NotAllowedError") {
      setError("Camera permission denied");
    }
  }
};
```

---

### 2. Microphone Permission Denied

**Symptom:** "Microphone permission denied" error

**Solutions:**
1. Allow microphone access (same as camera)
2. Check microphone is plugged in: `sudo lsof -i :0` (macOS)
3. Check volume levels aren't muted

**Code:**
```typescript
// client/hooks/useVoiceRecorder.ts
const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Set up MediaRecorder
  } catch (error) {
    if (error.name === "NotAllowedError") {
      setError("Microphone permission denied");
    }
  }
};
```

---

### 3. Face Not Detected

**Symptom:** "Face not detected" error during registration

**Solutions:**
1. **Better lighting:**
   - Position light source above you
   - Avoid harsh shadows
   - Face the camera directly

2. **Clear face:**
   - Remove sunglasses/hats
   - Ensure face is clearly visible
   - Fill 50% of frame with face

3. **Distance:**
   - Optimal distance: 30-60cm from camera
   - Too close: Face crops out
   - Too far: Low resolution

4. **Technical check:**
   ```bash
   # Test face detection
   python -c "
   import cv2
   import face_recognition
   image = face_recognition.load_image_file('face.jpg')
   faces = face_recognition.face_locations(image)
   print(f'Detected {len(faces)} faces')
   "
   ```

---

### 4. Face Matching Failed (Login)

**Symptom:** "Face not recognized" despite clear face

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Different lighting | Same lighting as registration |
| Different angle | Face front/centered |
| Facial hair/makeup | Match registration appearance |
| Threshold too high | Lower FACE_CONFIDENCE_THRESHOLD to 0.65 |
| Database empty | Register at least one user first |

**Debug Code:**
```typescript
// server/modules/faceAuth.ts
const pythonScript = `
import cv2
import face_recognition
import json

ref = face_recognition.load_image_file('${refPath}')
login = face_recognition.load_image_file('${loginPath}')

ref_encodings = face_recognition.face_encodings(ref)
login_encodings = face_recognition.face_encodings(login)

if not ref_encodings or not login_encodings:
  print(json.dumps({"error": "Face not found"}))
else:
  distance = face_recognition.face_distance([ref_encodings[0]], login_encodings[0])[0]
  match = distance < 0.6
  print(json.dumps({"match": match, "distance": float(distance)}))
`;
```

---

### 5. Voice Matching Failed

**Symptom:** "Voice verification failed"

**Solutions:**
1. **Audio quality:**
   - Speak clearly and naturally
   - Avoid background noise
   - Stable volume

2. **Microphone check:**
   ```bash
   # Test microphone on Linux
   ffmpeg -f alsa -i default test_audio.wav
   
   # Test on macOS
   ffmpeg -f avfoundation -i ":0" test_audio.wav
   ```

3. **Audio format:**
   - Registration: WebM (browser)
   - Converted: WAV (Python processing)
   - Check conversion: `ffprobe login_voice_*.webm`

4. **Threshold adjustment:**
   ```bash
   # In .env
   VOICE_CONFIDENCE_THRESHOLD=0.70  # More lenient
   ```

---

### 6. Database Connection Failed

**Symptom:** "Cannot connect to database"

**Solutions:**
1. **Check PostgreSQL running:**
   ```bash
   # Linux
   sudo systemctl status postgresql
   sudo systemctl start postgresql
   
   # macOS
   brew services list
   brew services start postgresql
   
   # Windows
   net start PostgreSQL
   ```

2. **Check connection string:**
   ```bash
   # Correct format
   postgresql://user:password@localhost:5432/biosecure
   
   # Test connection
   psql postgresql://user:password@localhost:5432/biosecure
   ```

3. **Create database:**
   ```bash
   createdb -U postgres biosecure
   ```

4. **Check migrations:**
   ```bash
   npm run db:push
   ```

---

### 7. Out of Memory Error

**Symptom:** "JavaScript heap out of memory"

**Solutions:**
1. **Increase Node memory:**
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 npm run dev
   ```

2. **Reduce image size:**
   ```typescript
   // Resize before sending
   const canvas = canvasRef.current;
   canvas.toBlob((blob) => {
     // blob ~50-100KB instead of 500KB
   }, 'image/jpeg', 0.7);
   ```

3. **Batch processing for many users:**
   ```typescript
   // Process in chunks instead of all at once
   const BATCH_SIZE = 10;
   for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
     const batch = allUsers.slice(i, i + BATCH_SIZE);
     await processBatch(batch);
   }
   ```

---

### 8. CORS Error

**Symptom:** "Access to XMLHttpRequest blocked by CORS policy"

**Solution:**
```typescript
// server/index.ts
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});
```

---

### 9. Python Script Not Found

**Symptom:** "Cannot find Python script" or "Python not in PATH"

**Solutions:**
1. **Check Python installed:**
   ```bash
   python --version
   python3 --version
   ```

2. **Add to PATH:**
   - Windows: Environment Variables → PATH → Add Python directory
   - Linux/macOS: Already in PATH

3. **Use full path:**
   ```typescript
   const pythonPath = process.env.PYTHON_PATH || 'python3';
   exec(`${pythonPath} script.py`, ...);
   ```

---

### 10. Vite Build Fails

**Symptom:** "Build failed" or "Module not found"

**Solutions:**
1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Clear cache:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check TypeScript:**
   ```bash
   npx tsc --noEmit
   ```

---

## Face Embeddings Quick Reference

### What is an Embedding?

**Simple:** A 128-dimensional fingerprint of a face

```
Your Face Image (500×500 pixels)
            ↓
  [Deep Neural Network]
            ↓
128-D Vector: [-0.234, 0.512, -0.187, ...]
            ↓
Used for instant comparison (0.1ms per match)
```

### Embedding Distance Interpretation

```
Distance Range | Interpretation | Action
0.0 - 0.4      | Same person    | ✅ MATCH
0.4 - 0.6      | Similar face   | ⚠️  REVIEW
0.6 - 1.0      | Different      | ❌ NO MATCH
```

### Extract Embedding (Python)

```python
import face_recognition
import json

# Load image
image = face_recognition.load_image_file("my_face.jpg")

# Extract embedding
encodings = face_recognition.face_encodings(image)
if encodings:
    embedding = encodings[0].tolist()  # Convert to list
    print(json.dumps(embedding))
else:
    print("No face found")
```

### Compare Embeddings (TypeScript)

```typescript
function euclideanDistance(vec1: number[], vec2: number[]): number {
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

const distance = euclideanDistance(embedding1, embedding2);
const match = distance < 0.6;  // Threshold
```

### Store & Retrieve Embeddings

```typescript
// Store in database
const user = await db.users.create({
  displayName: "John Doe",
  faceEmbedding: JSON.stringify(embedding),  // Store as JSON
  createdAt: new Date()
});

// Retrieve from database
const user = await db.users.findUnique({ where: { id: 1 } });
const embedding = JSON.parse(user.faceEmbedding);  // Parse JSON
```

---

## Environment Setup Checklist

### Pre-Installation

- [ ] Git installed
- [ ] Node.js 18+ installed
- [ ] Python 3.8+ installed
- [ ] PostgreSQL 12+ installed
- [ ] npm updated: `npm install -g npm@latest`

### Installation Steps

- [ ] Clone repository
- [ ] Run `npm install` in root
- [ ] Run `npm install` in client/
- [ ] Run `npm install` in server/
- [ ] Create `.env` file
- [ ] Install Python dependencies: `pip install -r requirements.txt`
- [ ] Download face landmark model: `python scripts/download_models.py`

### Database Setup

- [ ] PostgreSQL service running
- [ ] `DATABASE_URL` set correctly in `.env`
- [ ] Run `npm run db:push`
- [ ] Verify tables created: `npm run db:studio`

### Testing

- [ ] Register new user (face + voice)
- [ ] Login with registered credentials
- [ ] Check uploads/ folder for files
- [ ] Check database records created

### Production

- [ ] Set `NODE_ENV=production`
- [ ] Set `npm run build`
- [ ] Deploy to hosting
- [ ] Enable HTTPS
- [ ] Configure CORS for production domain

---

## Troubleshooting Matrix

| Error | Possible Causes | Solutions |
|-------|-----------------|-----------|
| "ECONNREFUSED" | DB not running | Start PostgreSQL |
| "ENOENT: no such file" | Path incorrect | Check file path |
| "SyntaxError: Unexpected token" | JSON parse error | Validate JSON |
| "Heap out of memory" | Too much data | Increase memory |
| "Module not found" | Dependency missing | Run npm install |
| "CORS error" | Wrong origin | Update CORS config |
| "Permission denied" | File permissions | Change chmod |
| "Port already in use" | Port 3000 taken | Use different port |
| "Can't find Python" | Python not in PATH | Add to PATH |
| "Face not detected" | Poor image quality | Better lighting |

---

## Performance Diagnostics

### Monitoring Response Times

```typescript
// Add timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
  });
  next();
});
```

### Expected Response Times

```
Operation               Time        Status
---                     ----        ------
Face capture           0ms         Real-time
Voice recording        3-5s        Real-time
Register API call      500-1000ms  OK
Login (5 users)        1-2s        OK
Login (50 users)       5-10s       SLOW
Login (100 users)      10-20s      VERY SLOW
```

### Optimization Targets

```
If response > 2s:
  ├─ Profile with Chrome DevTools
  ├─ Check Python script performance
  ├─ Consider embedding-based matching
  └─ Implement FAISS for 100+ users

If response > 5s:
  ├─ Use clustering
  ├─ Implement early-exit matching
  ├─ Consider separate face/voice threads
  └─ Implement caching
```

### Database Query Performance

```sql
-- Find slow queries
SELECT query, calls, mean_time FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Create indexes
CREATE INDEX idx_users_createdAt ON users(createdAt);
CREATE INDEX idx_authLogs_userId ON authLogs(userId);
```

### Resource Usage

```bash
# Monitor memory
node --expose-gc app.js

# Check CPU usage
top  # Linux/macOS
tasklist /v  # Windows

# Profile with Node
node --prof app.js
node --prof-process isolate-*.log > profile.txt
```

---

**End of Quick Reference & Troubleshooting Guide**

---

### Navigation Guide

For different needs, consult the appropriate document:

1. **01_COMPLETE_GUIDE_AND_OVERVIEW.md** → Project overview, setup, and getting started
2. **02_TECHNICAL_REFERENCE_AND_IMPLEMENTATION.md** → Deep architecture, code analysis, algorithms
3. **03_QUICK_REFERENCE_AND_TROUBLESHOOTING.md** → This document - commands, APIs, fixes

**Bookmark this quick reference for easy access to common commands and troubleshooting solutions!**
