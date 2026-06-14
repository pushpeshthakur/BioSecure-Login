import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execPromise = promisify(exec);

/**
 * LARGE-SCALE FACE AUTHENTICATION OPTIMIZATION
 * 
 * Use this when scaling beyond 100 users
 * 
 * Approach Selection:
 * - 100 users: Linear search (current approach, ~10ms)
 * - 1000 users: Use KDTree (~20ms)
 * - 10000 users: Use FAISS (~50ms)
 * - 100000+ users: Use Hierarchical Clustering (~500ms)
 */

interface IndexOptions {
  type: "linear" | "kdtree" | "faiss" | "clustering";
  numClusters?: number;
  dimension?: number;
}

/**
 * Face authentication using FAISS for large scale
 * 
 * Requires: pip install faiss-cpu
 * For GPU: pip install faiss-gpu
 */
export class FAISSAuthenticator {
  private indexPath: string;
  private userMappingPath: string;
  private numEmbeddings: number = 0;

  constructor(indexDir: string = "indexes") {
    this.indexPath = path.join(process.cwd(), indexDir, "face_faiss.index");
    this.userMappingPath = path.join(process.cwd(), indexDir, "user_mapping.json");

    // Create directories if they don't exist
    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }
  }

  /**
   * Add embeddings to FAISS index
   * 
   * For production, call once during initialization with all embeddings
   * Then cache the index for fast queries
   */
  async buildIndex(embeddings: Map<number, number[]>): Promise<{ success: boolean; count: number }> {
    try {
      const pythonScript = `
import faiss
import numpy as np
import json
from pathlib import Path

# Receive embeddings
embeddings_dict = json.loads('''${JSON.stringify(Array.from(embeddings))}''')
user_ids = [int(uid) for uid, _ in embeddings_dict]
embeddings_array = np.array([emb for _, emb in embeddings_dict], dtype=np.float32)

# Create FAISS index
index = faiss.IndexFlatL2(128)
index.add(embeddings_array)

# Save index
faiss.write_index(index, r'${this.indexPath}')

# Save user mapping
with open(r'${this.userMappingPath}', 'w') as f:
    json.dump({{"user_ids": user_ids, "count": len(user_ids)}}, f)

print(json.dumps({{"success": True, "count": len(user_ids)}}))
`;

      const scriptPath = path.join(process.cwd(), `build_faiss_${Date.now()}.py`);
      fs.writeFileSync(scriptPath, pythonScript);

      try {
        const { stdout } = await execPromise(`python "${scriptPath}"`);
        const result = JSON.parse(stdout.trim());
        this.numEmbeddings = result.count;

        fs.unlinkSync(scriptPath);
        return result;
      } catch (error) {
        fs.unlinkSync(scriptPath);
        throw error;
      }
    } catch (error) {
      console.error("Error building FAISS index:", error);
      return { success: false, count: 0 };
    }
  }

  /**
   * Query FAISS index for best matching face
   * 
   * Performance: ~50ms for 10,000 users (vs 100ms+ with linear)
   */
  async search(embedding: number[], threshold: number = 0.6): Promise<{
    bestUserId: number;
    distance: number;
    match: boolean;
  }> {
    try {
      if (!fs.existsSync(this.indexPath)) {
        return { bestUserId: -1, distance: Infinity, match: false };
      }

      const pythonScript = `
import faiss
import numpy as np
import json

# Load index
index = faiss.read_index(r'${this.indexPath}')

# Load user mapping
with open(r'${this.userMappingPath}', 'r') as f:
    mapping = json.load(f)

# Query embedding
query = np.array([${embedding.join(', ')}], dtype=np.float32).reshape(1, -1)

# Search
distances, indices = index.search(query, k=1)

best_idx = indices[0][0]
best_distance = distances[0][0]
best_user_id = mapping['user_ids'][best_idx]

print(json.dumps({{
  "bestUserId": int(best_user_id),
  "distance": float(best_distance),
  "match": float(best_distance) < ${threshold}
}}))
`;

      const scriptPath = path.join(process.cwd(), `query_faiss_${Date.now()}.py`);
      fs.writeFileSync(scriptPath, pythonScript);

      try {
        const { stdout } = await execPromise(`python "${scriptPath}"`);
        const result = JSON.parse(stdout.trim());
        fs.unlinkSync(scriptPath);
        return result;
      } catch (error) {
        fs.unlinkSync(scriptPath);
        throw error;
      }
    } catch (error) {
      console.error("Error querying FAISS index:", error);
      return { bestUserId: -1, distance: Infinity, match: false };
    }
  }

  /**
   * Incremental update (add new users without rebuilding entire index)
   */
  async addEmbedding(userId: number, embedding: number[]): Promise<boolean> {
    try {
      const pythonScript = `
import faiss
import numpy as np
import json

# Load index
try:
  index = faiss.read_index(r'${this.indexPath}')
except:
  # Index doesn't exist yet, create new one
  index = faiss.IndexFlatL2(128)

# Load user mapping
try:
  with open(r'${this.userMappingPath}', 'r') as f:
    mapping = json.load(f)
except:
  mapping = {"user_ids": []}

# Add new embedding
new_embedding = np.array([${embedding.join(', ')}], dtype=np.float32).reshape(1, -1)
index.add(new_embedding)

# Update mapping
mapping['user_ids'].append(${userId})
mapping['count'] = len(mapping['user_ids'])

# Save updated index and mapping
faiss.write_index(index, r'${this.indexPath}')
with open(r'${this.userMappingPath}', 'w') as f:
  json.dump(mapping, f)

print(json.dumps({{"success": True}}))
`;

      const scriptPath = path.join(process.cwd(), `add_faiss_${Date.now()}.py`);
      fs.writeFileSync(scriptPath, pythonScript);

      try {
        await execPromise(`python "${scriptPath}"`);
        fs.unlinkSync(scriptPath);
        this.numEmbeddings++;
        return true;
      } catch (error) {
        fs.unlinkSync(scriptPath);
        throw error;
      }
    } catch (error) {
      console.error("Error adding embedding to FAISS:", error);
      return false;
    }
  }

  getIndexSize(): number {
    return this.numEmbeddings;
  }
}

/**
 * Face authentication using KDTree (simpler alternative to FAISS)
 * 
 * Requires: pip install scipy
 * 
 * Good for:
 * - Moderate scale (1000-10,000 users)
 * - CPU-only environments
 * - Simpler deployment
 */
export class KDTreeAuthenticator {
  private indexPath: string;
  private userMappingPath: string;
  private numEmbeddings: number = 0;

  constructor(indexDir: string = "indexes") {
    this.indexPath = path.join(process.cwd(), indexDir, "face_kdtree.pickle");
    this.userMappingPath = path.join(process.cwd(), indexDir, "kdtree_mapping.json");

    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }
  }

  async buildIndex(embeddings: Map<number, number[]>): Promise<{ success: boolean; count: number }> {
    try {
      const pythonScript = `
from scipy.spatial import cKDTree
import numpy as np
import pickle
import json

# Receive embeddings
embeddings_dict = json.loads('''${JSON.stringify(Array.from(embeddings))}''')
user_ids = [int(uid) for uid, _ in embeddings_dict]
embeddings_array = np.array([emb for _, emb in embeddings_dict], dtype=np.float32)

# Build KDTree
tree = cKDTree(embeddings_array)

# Save tree and user mapping
with open(r'${this.indexPath}', 'wb') as f:
  pickle.dump(tree, f)

with open(r'${this.userMappingPath}', 'w') as f:
  json.dump({{"user_ids": user_ids, "count": len(user_ids)}}, f)

print(json.dumps({{"success": True, "count": len(user_ids)}}))
`;

      const scriptPath = path.join(process.cwd(), `build_kdtree_${Date.now()}.py`);
      fs.writeFileSync(scriptPath, pythonScript);

      try {
        const { stdout } = await execPromise(`python "${scriptPath}"`);
        const result = JSON.parse(stdout.trim());
        this.numEmbeddings = result.count;
        fs.unlinkSync(scriptPath);
        return result;
      } catch (error) {
        fs.unlinkSync(scriptPath);
        throw error;
      }
    } catch (error) {
      console.error("Error building KDTree index:", error);
      return { success: false, count: 0 };
    }
  }

  async search(embedding: number[], threshold: number = 0.6): Promise<{
    bestUserId: number;
    distance: number;
    match: boolean;
  }> {
    try {
      if (!fs.existsSync(this.indexPath)) {
        return { bestUserId: -1, distance: Infinity, match: false };
      }

      const pythonScript = `
from scipy.spatial import cKDTree
import pickle
import json

# Load tree
with open(r'${this.indexPath}', 'rb') as f:
  tree = pickle.load(f)

# Load user mapping
with open(r'${this.userMappingPath}', 'r') as f:
  mapping = json.load(f)

# Query
import numpy as np
query = np.array([${embedding.join(', ')}], dtype=np.float32)
distance, idx = tree.query(query, k=1)

best_user_id = mapping['user_ids'][idx]

print(json.dumps({{
  "bestUserId": int(best_user_id),
  "distance": float(distance),
  "match": float(distance) < ${threshold}
}}))
`;

      const scriptPath = path.join(process.cwd(), `query_kdtree_${Date.now()}.py`);
      fs.writeFileSync(scriptPath, pythonScript);

      try {
        const { stdout } = await execPromise(`python "${scriptPath}"`);
        const result = JSON.parse(stdout.trim());
        fs.unlinkSync(scriptPath);
        return result;
      } catch (error) {
        fs.unlinkSync(scriptPath);
        throw error;
      }
    } catch (error) {
      console.error("Error querying KDTree:", error);
      return { bestUserId: -1, distance: Infinity, match: false };
    }
  }

  getIndexSize(): number {
    return this.numEmbeddings;
  }
}

/**
 * Recommendation: Choose index type based on scale
 */
export function recommendIndexType(numUsers: number): IndexOptions["type"] {
  if (numUsers < 100) return "linear";
  if (numUsers < 10000) return "kdtree";
  if (numUsers < 100000) return "faiss";
  return "clustering";
}

/**
 * Example usage:
 * 
 * // For 10,000 users:
 * const auth = new FAISSAuthenticator();
 * 
 * // Build index from all embeddings
 * const embeddings = new Map();
 * for (const user of users) {
 *   embeddings.set(user.id, user.faceEmbedding);
 * }
 * await auth.buildIndex(embeddings);
 * 
 * // Query on login
 * const result = await auth.search(loginEmbedding);
 * if (result.match) {
 *   // Found matching user
 * }
 */
