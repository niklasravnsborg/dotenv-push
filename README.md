# dotenv-push

A CLI tool to push environment variables to cloud providers.

## Features

- Push `.env` files to Vercel (more providers coming soon)
- Support for reading environment variables from stdin
- Works with both encrypted (via dotenvx) and plain `.env` files
- Support for multiple environments (.env.production, .env.staging, etc.)
- Interactive or automated deployment modes

## Installation

```bash
npm install -g dotenv-push
```

## Usage

### Basic Usage

```bash
# Push .env.production to Vercel (uses .vercel/project.json)
dotenv-push vercel

# Specify project ID and token
dotenv-push vercel --project abc123 --token your-vercel-token

# Push different environment file
dotenv-push vercel --env .env.staging

# Skip confirmation prompts
dotenv-push vercel --yes
```

### With stdin (piping)

```bash
# From a file
cat .env | dotenv-push vercel --stdin

# From dotenvx (for encrypted files)
dotenvx decrypt --env-file=.env.production --stdout | dotenv-push vercel --stdin

# From any command that outputs env format
echo "API_KEY=secret" | dotenv-push vercel --stdin --project abc123
```

### Advanced Examples

```bash
# Decrypt with dotenvx and push to Vercel
dotenvx decrypt --env-file=.env.production --stdout | dotenv-push vercel --stdin --yes

# Use with environment substitution
envsubst < .env.template | dotenv-push vercel --stdin

# Filter specific variables
grep "^NEXT_PUBLIC_" .env | dotenv-push vercel --stdin
```

## Options

- `-p, --project <id>` - Project ID (optional for Vercel, uses .vercel/project.json)
- `-t, --token <token>` - Provider API token
- `-e, --env <file>` - Environment file path (defaults to .env.production)
- `-s, --stdin` - Read environment variables from stdin
- `-y, --yes` - Skip confirmation prompts
- `-h, --help` - Show help message

## Environment Variables

- `VERCEL_TOKEN` - Vercel API token (used if --token not provided)

## Providers

### Vercel

For Vercel, the tool will:

1. Read project ID from `.vercel/project.json` if not specified
2. Replace ALL production environment variables with the ones from your file/stdin
3. Automatically mark sensitive variables (containing KEY, SECRET, TOKEN) as encrypted

## Use Cases

1. **Plain .env files**: Push unencrypted environment variables directly
2. **Encrypted files**: Use with `dotenvx decrypt --stdout` for encrypted variables
3. **CI/CD pipelines**: Use `--yes` flag to skip confirmations
4. **Filtered deployments**: Use grep/sed to deploy only specific variables

## Requirements

- Node.js 18+
- Provider-specific setup (e.g., .vercel/project.json for Vercel)

## Development

```bash
# Install dependencies
npm install

# Develop with Bun
npm run dev

# Build (Bun bundler → Node-compatible ESM)
npm run build

# Run tests (Bun test runner)
npm run test

# Lint & Format (Biome)
npm run check         # lint + format diagnostics
npm run lint          # lint only
npm run lint:fix      # apply safe lint fixes
npm run format:check  # format check (no write)
npm run format        # write formatted files
```

Note: The published CLI remains Node-compatible; dist output is built with Bun and includes a Node shebang so `node` can execute it. Bun is used for local dev, tests, and builds.

### Releasing

To publish a new version to npm, use one of the following commands:

```bash
# Patch release (0.1.0 → 0.1.1) - for bug fixes
npm version patch && git push origin main --tags

# Minor release (0.1.0 → 0.2.0) - for new features
npm version minor && git push origin main --tags

# Major release (0.1.0 → 1.0.0) - for breaking changes
npm version major && git push origin main --tags
```

This updates `package.json`, creates a git tag, and pushes it. The GitHub Actions workflow will automatically publish to npm.

## License

MIT
