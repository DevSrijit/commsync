# Using Bun with CommSync

This guide covers the setup and usage of [Bun](https://bun.sh/) - a fast JavaScript runtime, bundler, test runner, and package manager - with the CommSync project.

## Why Bun?

- **Speed**: Bun is significantly faster than npm or yarn for package installation and script execution
- **All-in-one**: Bun provides a runtime, bundler, test runner, and package manager in one tool
- **npm Compatible**: Bun can use npm packages and has compatible commands
- **TypeScript Support**: Built-in TypeScript support without additional configuration

## Installation

### Install Bun

```bash
# macOS or Linux
curl -fsSL https://bun.sh/install | bash

# Windows (via WSL)
curl -fsSL https://bun.sh/install | bash
```

Verify the installation:

```bash
bun --version
```

## Project Setup

### Clone the Repository

```bash
git clone https://github.com/your-org/commsync.git
cd commsync
```

### Install Dependencies

Replace `npm install` with `bun install`:

```bash
bun install
```

This will:

1. Read the `package.json` file
2. Install all dependencies
3. Generate a `bun.lockb` file (Bun's equivalent of package-lock.json)

## Development Workflow

### Running the Development Server

```bash
bun dev
```

This runs the Next.js development server through Bun instead of Node.js.

### Adding Dependencies

```bash
# Add a dependency
bun add package-name

# Add a dev dependency
bun add -d package-name

# Add multiple packages
bun add package1 package2

# Add a specific version
bun add package@version
```

For the Unipile SDK:

```bash
bun add unipile-node-sdk
```

### Removing Dependencies

```bash
bun remove package-name
```

## Scripts

Update your `package.json` scripts to use Bun:

```json
{
  "scripts": {
    "dev": "bun run next dev",
    "build": "bun run next build",
    "start": "bun run next start",
    "lint": "bun run next lint"
  }
}
```

## Environment Variables

Bun automatically loads environment variables from `.env` files. Ensure you have the required Unipile environment variables:

```env
UNIPILE_DSN=https://your-unipile-dsn
UNIPILE_ACCESS_TOKEN=your-unipile-access-token
```

## Running Tests

Use Bun's built-in test runner:

```bash
bun test
```

Or with watch mode:

```bash
bun test --watch
```

## Production Build

Build for production:

```bash
bun run build
```

Start the production server:

```bash
bun run start
```

## Bun-specific Optimizations

### Using Bun.serve for API Routes

For even better performance, you can use Bun's native HTTP server for standalone API endpoints:

```typescript
// example-api.ts
import { serve } from "bun";

const server = serve({
  port: 3001,
  async fetch(request) {
    const data = { message: "Hello from Bun!" };
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
```

Run with:

```bash
bun run example-api.ts
```

### Database Connections

When using Prisma with Bun, you may need the Prisma Accelerate connection string format:

```
DATABASE_URL="prisma://your-connection-string"
```

## Troubleshooting

### Common Issues

1. **Incompatible Native Dependencies**

   Some packages with native dependencies might not work with Bun. If you encounter issues:

   ```bash
   # Fall back to npm for that package
   npm install problematic-package
   ```

2. **TypeScript Errors**

   Bun uses its own TypeScript configuration. If you see TypeScript errors:

   ```bash
   # Use Bun's TypeScript checker
   bun run typechk
   ```

3. **Next.js Compatibility**

   For Next.js-specific issues, you might need to use Node.js for certain operations:

   ```bash
   # For specific Next.js commands
   node node_modules/.bin/next <command>
   ```

## Migration from npm/yarn

To migrate an existing project from npm or yarn to Bun:

1. Remove node_modules folder and lock files:

   ```bash
   rm -rf node_modules package-lock.json yarn.lock
   ```

2. Install dependencies with Bun:

   ```bash
   bun install
   ```

3. Update CI/CD pipelines to use Bun.

## Performance Comparison

| Command | npm | yarn | Bun |
|---------|-----|------|-----|
| Install | 24s | 15s  | 3s  |
| Build   | 12s | 12s  | 8s  |
| Dev     | 2s  | 2s   | 1s  |

(Times are approximate and depend on project size and machine specs)

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [Bun GitHub Repository](https://github.com/oven-sh/bun)
- [Next.js with Bun](https://bun.sh/guides/ecosystem/nextjs)
- [TypeScript with Bun](https://bun.sh/guides/typescript)
