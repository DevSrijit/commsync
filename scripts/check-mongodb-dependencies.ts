import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const stat = util.promisify(fs.stat);

// Patterns to look for in the codebase
const patterns = [
  { pattern: /ObjectId|ObjectID/g, description: 'MongoDB ObjectId references' },
  { pattern: /mongodb/g, description: 'MongoDB references' },
  { pattern: /@db\.ObjectId/g, description: 'Prisma MongoDB ObjectId type' },
  { pattern: /@map\("_id"\)/g, description: 'MongoDB _id mapping' },
  { pattern: /\$lookup/g, description: 'MongoDB aggregation $lookup' },
  { pattern: /\$match/g, description: 'MongoDB aggregation $match' },
  { pattern: /\.aggregate\(/g, description: 'MongoDB aggregation functions' },
  { pattern: /\.collection\(/g, description: 'MongoDB collection references' },
  { pattern: /new ObjectId/g, description: 'MongoDB ObjectId creation' },
  { pattern: /\.insertOne\(|\.insertMany\(/g, description: 'MongoDB direct insert operations' },
  { pattern: /\.updateOne\(|\.updateMany\(/g, description: 'MongoDB direct update operations' },
  { pattern: /\.deleteOne\(|\.deleteMany\(/g, description: 'MongoDB direct delete operations' },
  { pattern: /\.findOne\(|\.find\(/g, description: 'MongoDB direct find operations' },
  { pattern: /mongoose/g, description: 'Mongoose ORM usage' },
];

// Extensions to check
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

// Directories to exclude
const excludeDirs = ['node_modules', '.next', 'out', 'build', 'dist', '.git', 'prisma/migrations'];

async function scanDirectory(dir: string): Promise<void> {
  try {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = await stat(fullPath);
      
      // Skip excluded directories
      if (stats.isDirectory() && !excludeDirs.includes(entry)) {
        await scanDirectory(fullPath);
        continue;
      }
      
      // Check files with the specified extensions
      const ext = path.extname(entry);
      if (stats.isFile() && extensions.includes(ext)) {
        await checkFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
}

async function checkFile(filePath: string): Promise<void> {
  try {
    const content = await readFile(filePath, 'utf8');
    let hasMatches = false;
    
    for (const { pattern, description } of patterns) {
      const matches = content.match(pattern);
      
      if (matches && matches.length > 0) {
        if (!hasMatches) {
          console.log(`\nFile: ${filePath}`);
          hasMatches = true;
        }
        
        console.log(`  - Found ${matches.length} ${description}`);
        
        // Show line contexts for up to 3 matches
        const lines = content.split('\n');
        let matchesShown = 0;
        
        for (let i = 0; i < lines.length && matchesShown < 3; i++) {
          if (lines[i].match(pattern)) {
            console.log(`    Line ${i + 1}: ${lines[i].trim()}`);
            matchesShown++;
          }
        }
        
        if (matches.length > 3) {
          console.log(`    ... and ${matches.length - 3} more matches`);
        }
      }
    }
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error);
  }
}

async function main() {
  console.log('Scanning project for MongoDB dependencies...');
  console.log('This will help identify code that might need manual updates after migrating to PostgreSQL.');
  console.log('-------------------------------------------');
  
  await scanDirectory(path.resolve(process.cwd()));
  
  console.log('\nScan complete. Review the findings above for MongoDB-specific code that may need updates.');
  console.log('Common changes to make:');
  console.log('1. Replace MongoDB ObjectId operations with string ID handling');
  console.log('2. Update any direct MongoDB query operations to use Prisma client');
  console.log('3. Check for MongoDB-specific aggregation pipelines and rewrite as SQL queries or Prisma queries');
  console.log('4. Update any MongoDB-specific data validation');
}

main().catch(console.error); 