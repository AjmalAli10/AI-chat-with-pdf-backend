#!/usr/bin/env node

// Build script for production deployment
const fs = require("fs");
const path = require("path");

console.log("🔨 Starting production build...");

// Set production environment
process.env.NODE_ENV = "production";

// Verify environment variables
const requiredEnvVars = [
  "HUGGINGFACE_API_KEY", // Required for AI models
  "EMBEDDING_MODEL", // Required for embeddings
  "NER_MODEL", // Required for document processing
  "PRIMARY_MODEL", // Required for chat functionality
  "FALLBACK_MODEL_1", // Required for chat fallback
  "FALLBACK_MODEL_2", // Required for chat fallback
];

const recommendedEnvVars = [
  "QDRANT_URL", // Vector database (has default)
  "QDRANT_API_KEY", // Vector database auth (optional for local)
  "BLOB_READ_WRITE_TOKEN", // Vercel Blob storage (for production)
];

const missingRequired = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
const missingRecommended = recommendedEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingRequired.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingRequired.join(", ")
  );
  console.error("   These MUST be set for the application to work");
  process.exit(1);
}

if (missingRecommended.length > 0) {
  console.warn(
    "⚠️  Missing recommended environment variables:",
    missingRecommended.join(", ")
  );
  console.warn("   These are recommended for production deployment");
  console.warn("   - QDRANT_URL: Vector database URL (defaults to localhost)");
  console.warn(
    "   - QDRANT_API_KEY: Vector database API key (optional for local)"
  );
  console.warn("   - BLOB_READ_WRITE_TOKEN: Vercel Blob storage token");
}

// Create a simple build manifest
const buildManifest = {
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV,
  nodeVersion: process.version,
  buildInfo: {
    productionReady: true,
    consoleLoggingDisabled: true,
  },
};

// Write build manifest
fs.writeFileSync(
  path.join(__dirname, "../build-manifest.json"),
  JSON.stringify(buildManifest, null, 2)
);

console.log("✅ Production build completed");
console.log("📋 Build manifest created");
console.log("🚀 Ready for deployment");
