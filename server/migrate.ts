import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log("Starting database migration...");
    
    // Create auth_challenges table
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_challenges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        type VARCHAR(50) NOT NULL,
        voice_phrase TEXT,
        face_action VARCHAR(50),
        token TEXT NOT NULL UNIQUE,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP
      )
    `);
    console.log("✓ Created auth_challenges table");
    
    // Create liveness_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS liveness_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        type VARCHAR(50) NOT NULL,
        passed BOOLEAN NOT NULL,
        confidence NUMERIC(3, 2),
        metrics JSONB,
        attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Created liveness_logs table");
    
    // Create auth_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        success BOOLEAN NOT NULL,
        failure_reason TEXT,
        face_confidence NUMERIC(3, 2),
        voice_confidence NUMERIC(3, 2),
        ip_address VARCHAR(45),
        attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Created auth_logs table");
    
    // Add new columns to users table if they don't exist
    const columnsToAdd = [
      { name: "face_image_cropped_path", type: "TEXT" },
      { name: "face_embedding", type: "JSONB" },
      { name: "voice_template", type: "JSONB" },
      { name: "face_anti_spoof_score", type: "NUMERIC(3, 2)" },
      { name: "face_liveness_verified", type: "BOOLEAN DEFAULT FALSE" },
      { name: "voice_liveness_verified", type: "BOOLEAN DEFAULT FALSE" },
      { name: "last_auth_at", type: "TIMESTAMP" },
    ];
    
    for (const col of columnsToAdd) {
      try {
        await client.query(`
          ALTER TABLE users ADD COLUMN ${col.name} ${col.type}
        `);
        console.log(`✓ Added column ${col.name} to users table`);
      } catch (error: any) {
        if (error.code === "42701") {
          console.log(`ℹ Column ${col.name} already exists`);
        } else {
          throw error;
        }
      }
    }
    
    console.log("\n✅ Database migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

runMigration();
