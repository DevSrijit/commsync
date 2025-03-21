import { Client, Storage, ID } from 'appwrite';

// Initialize Appwrite client
const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '');

// Initialize Storage
const storage = new Storage(client);

// Storage bucket ID for media files
const MEDIA_BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID || '';

/**
 * Upload files to Appwrite storage and get public URLs
 * @param files Array of files to upload
 * @returns Array of public URLs for the uploaded files
 */
export async function uploadFilesToAppwrite(files: File[]): Promise<string[]> {
  if (!files || files.length === 0) {
    return [];
  }

  try {
    // Limit to 5 files max as per JustCall API restriction
    const filesToUpload = files.slice(0, 5);
    const uploadPromises = filesToUpload.map(async (file) => {
      // Create a unique ID for the file
      const fileId = ID.unique();
      
      // Upload the file to Appwrite Storage
      const result = await storage.createFile(
        MEDIA_BUCKET_ID,
        fileId,
        file
      );
      
      // Get the public URL for the file
      const fileUrl = storage.getFileView(MEDIA_BUCKET_ID, fileId);
      
      return fileUrl.href;
    });
    
    // Wait for all uploads to complete
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error('Error uploading files to Appwrite:', error);
    throw new Error('Failed to upload media files');
  }
} 