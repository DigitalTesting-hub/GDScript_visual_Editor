import { type User, type InsertUser, type SavedScript, type InsertSavedScript } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getSavedScripts(): Promise<SavedScript[]>;
  getSavedScript(id: string): Promise<SavedScript | undefined>;
  saveSavedScript(script: InsertSavedScript): Promise<SavedScript>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private savedScripts: Map<string, SavedScript>;

  constructor() {
    this.users = new Map();
    this.savedScripts = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getSavedScripts(): Promise<SavedScript[]> {
    return Array.from(this.savedScripts.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async getSavedScript(id: string): Promise<SavedScript | undefined> {
    return this.savedScripts.get(id);
  }

  async saveSavedScript(script: InsertSavedScript): Promise<SavedScript> {
    const id = randomUUID();
    const savedScript: SavedScript = {
      ...script,
      id,
      createdAt: Date.now(),
    };
    this.savedScripts.set(id, savedScript);
    return savedScript;
  }
}

export const storage = new MemStorage();
