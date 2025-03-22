/**
 * Utility functions for running migrations on the client
 */

let migrationsRun = false;

/**
 * Run all migrations that need to be executed
 */
export async function runMigrations() {
  if (migrationsRun || typeof window === 'undefined') {
    return;
  }
  
  try {
    // Run the groups migration
    await migrateGroups();
    
    migrationsRun = true;
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
  }
}

/**
 * Migrate groups to include phoneNumbers field
 */
async function migrateGroups() {
  try {
    const response = await fetch('/api/migrate/groups', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to migrate groups: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Groups migration result:', result.message);
    
    return result;
  } catch (error) {
    console.error('Groups migration failed:', error);
    throw error;
  }
} 