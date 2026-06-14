import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastAuth(userId: number): Promise<void>;
  createUserWithEmbeddings(data: {
    displayName: string;
    faceImagePath: string;
    voiceAudioPath: string;
    faceImageCroppedPath?: string;
    faceEmbedding?: number[];
    voiceTemplate?: Record<string, unknown>;
    faceLivenessVerified?: boolean;
    voiceLivenessVerified?: boolean;
    faceAntiSpoofScore?: number;
  }): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.displayName, username));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createUserWithEmbeddings(data: {
    displayName: string;
    faceImagePath: string;
    voiceAudioPath: string;
    faceImageCroppedPath?: string;
    faceEmbedding?: number[];
    voiceTemplate?: Record<string, unknown>;
    faceLivenessVerified?: boolean;
    voiceLivenessVerified?: boolean;
    faceAntiSpoofScore?: number;
  }): Promise<User> {
    const [user] = await db.insert(users).values({
      displayName: data.displayName,
      faceImagePath: data.faceImagePath,
      voiceAudioPath: data.voiceAudioPath,
      faceImageCroppedPath: data.faceImageCroppedPath,
      faceEmbedding: data.faceEmbedding ? JSON.stringify(data.faceEmbedding) : null,
      voiceTemplate: data.voiceTemplate ? JSON.stringify(data.voiceTemplate) : null,
      faceLivenessVerified: data.faceLivenessVerified ?? false,
      voiceLivenessVerified: data.voiceLivenessVerified ?? false,
      faceAntiSpoofScore: data.faceAntiSpoofScore ? String(data.faceAntiSpoofScore) : "0",
    }).returning();
    return user;
  }

  async updateUserLastAuth(userId: number): Promise<void> {
    await db.update(users)
      .set({ lastAuthAt: new Date() })
      .where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
