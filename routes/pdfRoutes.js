const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const dotenv = require("dotenv");
const { del } = require("@vercel/blob");

dotenv.config();

const pdfService = require("../services/pdfService");
const embeddingService = require("../services/embeddingService");
const vectorDBService = require("../services/vectorDBService");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB default
    fieldSize: 10 * 1024 * 1024, // 10MB for field size
  },
  fileFilter: (req, file, cb) => {
    // Check if file is PDF
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

/**
 * POST /api/pdf/upload
 * Upload and process a PDF file
 */
router.post("/upload", upload.single("pdf"), async (req, res) => {
  let pdfResult = null;
  let embeddings = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file provided" });
    }

    console.log(`📄 Processing PDF: ${req.file.originalname}`);

    // Step 1-4: Process PDF through the pipeline
    pdfResult = await pdfService.processPDF(
      req.file,
      req.abortController.signal
    );

    // Step 5: Create embeddings with abort checking
    embeddings = await embeddingService.chunkAndEmbed(
      pdfResult.structuredData,
      pdfResult.fileId,
      req.abortController.signal
    );

    // Step 6: Store in vector database
    await vectorDBService.initializeCollection();
    await vectorDBService.storeEmbeddings(
      embeddings,
      req.abortController.signal
    );

    res.json({
      success: true,
      message: "PDF processed successfully",
      data: {
        fileId: pdfResult.fileId,
        fileName: pdfResult.fileName,
        originalName: pdfResult.originalName,
        documentType: pdfResult.structuredData.documentType,
        totalPages: pdfResult.parsedData.totalPages,
        sections: pdfResult.structuredData.sections.length,
        chunks: embeddings.length,
        summary: pdfResult.structuredData.summary,
        suggestions: pdfResult.structuredData.suggestions || [],
        blobUrl: pdfResult.blobUrl,
      },
    });
  } catch (error) {
    console.error("Error uploading PDF:", error);

    if (error.name === "AbortError") {
      console.log("🛑 PDF processing aborted due to client disconnect");
      return;
    }

    // Only send error response if request hasn't been aborted
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to process PDF",
        message: error.message,
      });
    }
  }
});

/**
 * GET /api/pdf/files
 * Get all uploaded files
 */
router.get("/files", async (req, res) => {
  try {
    const files = await vectorDBService.getAllFiles();
    res.json({
      success: true,
      files: files,
    });
  } catch (error) {
    console.error("Error getting files:", error);
    res.status(500).json({
      error: "Failed to get files",
      message: error.message,
    });
  }
});

/**
 * GET /api/pdf/file/:fileId
 * Get specific file information
 */
router.get("/file/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const chunks = await vectorDBService.searchByFileId(fileId, 50);

    if (chunks.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    // Group chunks by section
    const sections = {};
    chunks.forEach((chunk) => {
      const section = chunk.metadata.sectionTitle || "Unknown";
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push(chunk.content);
    });

    res.json({
      success: true,
      fileId: fileId,
      documentType: chunks[0].metadata.documentType,
      sections: sections,
      totalChunks: chunks.length,
    });
  } catch (error) {
    console.error("Error getting file:", error);
    res.status(500).json({
      error: "Failed to get file",
      message: error.message,
    });
  }
});

/**
 * DELETE /api/pdf/file/:fileId
 * Delete a file and its embeddings
 */
router.delete("/file/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    // Delete from vector database
    await vectorDBService.deleteByFileId(fileId);

    // Delete from Vercel Blob (if we have the blob URL stored)
    // Note: We would need to store blob URLs in the vector database to delete them
    // For now, we'll just delete from the vector database
    console.log(`🗑️ Deleted file ${fileId} from vector database`);

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({
      error: "Failed to delete file",
      message: error.message,
    });
  }
});

/**
 * GET /api/pdf/health
 * Check PDF processing service health
 */
router.get("/health", async (req, res) => {
  try {
    const vectorDBHealth = await vectorDBService.healthCheck();

    res.json({
      success: true,
      services: {
        pdfProcessing: "healthy",
        vectorDatabase: vectorDBHealth.status,
        embeddingService: "healthy",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      error: "Health check failed",
      message: error.message,
    });
  }
});

/**
 * GET /api/pdf/stats
 * Get processing statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const collectionInfo = await vectorDBService.getCollectionInfo();
    const files = await vectorDBService.getAllFiles();

    res.json({
      success: true,
      stats: {
        totalFiles: files.length,
        totalChunks: collectionInfo.pointsCount,
        vectorSize: collectionInfo.vectorSize,
        documentTypes: files.reduce((acc, file) => {
          acc[file.documentType] = (acc[file.documentType] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({
      error: "Failed to get stats",
      message: error.message,
    });
  }
});

module.exports = router;
