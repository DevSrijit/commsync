// Encryption utilities using Node.js crypto library for AES encryption

import * as crypto from 'crypto';

// Secret key for encryption - in production, store this in env vars
const SECRET_KEY =
  process.env.ENCRYPTION_KEY || "QPwlER+QvIMSlglYdPfmbe4u9Kilx0xFm1lOOFxrRFA=";

// Initialization vector length for AES
const IV_LENGTH = 16; // 16 bytes for AES

export function encryptData(data: any): string {
  try {
    // Convert data to JSON string
    const jsonString = JSON.stringify(data);
    
    // Create a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher using AES-256-CBC
    const key = Buffer.from(SECRET_KEY, 'base64');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(jsonString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Combine IV and encrypted data and return as base64 string
    // We prepend the IV to the encrypted data so we can use it for decryption
    const result = Buffer.concat([iv, Buffer.from(encrypted, 'base64')]);
    return result.toString('base64');
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt data");
  }
}

export function decryptData(encryptedData: string): any {
  try {
    // Convert the combined data back to a buffer
    const buffer = Buffer.from(encryptedData, 'base64');
    
    // Extract the IV from the first 16 bytes
    const iv = buffer.slice(0, IV_LENGTH);
    
    // Extract the encrypted data (everything after the IV)
    const encrypted = buffer.slice(IV_LENGTH).toString('base64');
    
    // Create decipher
    const key = Buffer.from(SECRET_KEY, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse and return the JSON data
    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data");
  }
}