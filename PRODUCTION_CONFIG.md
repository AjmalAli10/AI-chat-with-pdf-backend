# Production Configuration

This document explains how console logging is configured for production deployments.

## Console Logging in Production

### Overview

The application uses a custom logger utility (`utils/logger.js`) that automatically disables console output in production environments. This ensures that:

- No console.log statements appear in production logs
- No sensitive information is leaked through console output
- Production deployments are clean and professional

### How It Works

1. **Environment Detection**: The logger checks `process.env.NODE_ENV`
2. **Conditional Logging**: Console statements only execute when `NODE_ENV !== 'production'`
3. **Automatic Disabling**: In production, all console methods are effectively no-ops

### Logger Methods

```javascript
const Logger = require("./utils/logger");

Logger.log("This will not appear in production");
Logger.error("Errors are also suppressed in production");
Logger.warn("Warnings are suppressed too");
Logger.info("Info messages are suppressed");
Logger.debug("Debug messages are suppressed");
```

### Environment Configuration

#### Development

```bash
NODE_ENV=development npm run dev
```

- All console statements are visible
- Full debugging information available

#### Production

```bash
NODE_ENV=production npm start
```

- Console statements are suppressed
- Only essential error handling remains
- Clean production logs

### Vercel Deployment

The `vercel.json` file automatically sets `NODE_ENV=production` for all deployments:

```json
{
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Build Process

The build script (`scripts/build.js`) ensures:

- Production environment is set
- Required environment variables are checked
- Build manifest is created
- Console logging is properly configured

#### Required Environment Variables

**Critical (must be set):**

- `HUGGINGFACE_API_KEY` - Required for AI model interactions
- `EMBEDDING_MODEL` - Required for text embeddings
- `NER_MODEL` - Required for document processing
- `PRIMARY_MODEL` - Required for chat functionality
- `FALLBACK_MODEL_1` - Required for chat fallback
- `FALLBACK_MODEL_2` - Required for chat fallback

**Recommended for production:**

- `QDRANT_URL` - Vector database URL (defaults to localhost)
- `QDRANT_API_KEY` - Vector database authentication (optional for local)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token

**Optional (have defaults):**

- `PORT` - Server port (defaults to 3000)
- `NODE_ENV` - Environment (set to 'production' automatically)
- `MAX_FILE_SIZE` - File upload limit (defaults to 50MB)

### Files Updated

The following files have been updated to use the logger:

- `api/server.js` - Main server file
- `routes/pdfRoutes.js` - PDF processing routes
- `routes/chatRoutes.js` - Chat functionality routes
- `utils/logger.js` - Logger utility (new)

### Testing

To test the production configuration locally:

```bash
# Test production mode
NODE_ENV=production npm start

# Test development mode
NODE_ENV=development npm run dev
```

### Benefits

1. **Security**: No sensitive data in production logs
2. **Performance**: Reduced I/O overhead
3. **Cleanliness**: Professional production environment
4. **Debugging**: Full logging still available in development

### Migration Notes

If you need to add new console statements:

1. Import the logger: `const Logger = require('../utils/logger');`
2. Replace `console.log()` with `Logger.log()`
3. Replace `console.error()` with `Logger.error()`
4. Replace `console.warn()` with `Logger.warn()`

This ensures all logging follows the production-safe pattern.
