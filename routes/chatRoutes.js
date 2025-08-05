const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const chatService = require("../services/chatService");
const vectorDBService = require("../services/vectorDBService");
const Logger = require("../utils/logger");

const router = express.Router();

/**
 * POST /api/chat/query
 * Chat with a specific PDF or all PDFs
 */
router.post("/query", async (req, res) => {
  try {
    const { query, fileId, chatHistory = [] } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "Query is required" });
    }

    Logger.log(`💬 Chat query: ${query}${fileId ? ` (File: ${fileId})` : ""}`);

    const result = await chatService.chatWithPDF(query, fileId, chatHistory);

    res.json({
      success: true,
      response: result.response,
      context: result.context,
      metadata: result.metadata,
    });
  } catch (error) {
    Logger.error("Error in chat query:", error);
    res.status(500).json({
      error: "Chat query failed",
      message: error.message,
    });
  }
});

/**
 * POST /api/chat/analyze
 * Analyze a specific document
 */
router.post("/analyze", async (req, res) => {
  try {
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Get document type from vector database
    const chunks = await vectorDBService.searchByFileId(fileId, 1);

    if (chunks.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const documentType = chunks[0].metadata.documentType;
    const analysis = await chatService.analyzeDocument(fileId, documentType);

    res.json({
      success: true,
      analysis: analysis.analysis,
      documentType: analysis.documentType,
      chunksAnalyzed: analysis.chunksAnalyzed,
    });
  } catch (error) {
    Logger.error("Error analyzing document:", error);
    res.status(500).json({
      error: "Document analysis failed",
      message: error.message,
    });
  }
});

/**
 * POST /api/chat/improve
 * Improve a specific section of a document
 */
router.post("/improve", async (req, res) => {
  try {
    const { fileId, sectionName, improvementType } = req.body;

    if (!fileId || !sectionName || !improvementType) {
      return res.status(400).json({
        error: "File ID, section name, and improvement type are required",
      });
    }

    const improvement = await chatService.improveSection(
      fileId,
      sectionName,
      improvementType
    );

    if (improvement.error) {
      return res.status(404).json({ error: improvement.error });
    }

    res.json({
      success: true,
      originalSection: improvement.originalSection,
      improvedSection: improvement.improvedSection,
      sectionName: improvement.sectionName,
      improvementType: improvement.improvementType,
    });
  } catch (error) {
    Logger.error("Error improving section:", error);
    res.status(500).json({
      error: "Section improvement failed",
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/suggestions/:fileId
 * Get follow-up questions for a document
 */
router.get("/suggestions/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get document type from vector database
    const chunks = await vectorDBService.searchByFileId(fileId, 1);

    if (chunks.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const documentType = chunks[0].metadata.documentType;
    const questions = await chatService.generateFollowUpQuestions(
      fileId,
      documentType
    );

    res.json({
      success: true,
      questions: questions,
      documentType: documentType,
    });
  } catch (error) {
    Logger.error("Error generating suggestions:", error);
    res.status(500).json({
      error: "Failed to generate suggestions",
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/search
 * Search for documents by query
 */
router.get("/search", async (req, res) => {
  try {
    const { query, documentType, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Get query embedding
    const embeddingService = require("../services/embeddingService");
    const queryEmbedding = await embeddingService.getQueryEmbedding(query);

    // Build search filter
    let filter = null;
    if (documentType) {
      filter = {
        must: [
          {
            key: "documentType",
            match: { value: documentType },
          },
        ],
      };
    }

    // Search for similar chunks
    const results = await vectorDBService.searchSimilar(
      queryEmbedding,
      parseInt(limit),
      filter
    );

    // Group results by file
    const groupedResults = {};
    results.forEach((result) => {
      const fileId = result.metadata.fileId;
      if (!groupedResults[fileId]) {
        groupedResults[fileId] = {
          fileId: fileId,
          documentType: result.metadata.documentType,
          matches: [],
        };
      }
      groupedResults[fileId].matches.push({
        content: result.content,
        score: result.score,
        section: result.metadata.sectionTitle,
      });
    });

    res.json({
      success: true,
      query: query,
      results: Object.values(groupedResults),
      totalResults: results.length,
    });
  } catch (error) {
    Logger.error("Error searching documents:", error);
    res.status(500).json({
      error: "Search failed",
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/context/:fileId
 * Get context information for a specific file
 */
router.get("/context/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const chunks = await vectorDBService.searchByFileId(fileId, 20);

    if (chunks.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Group by sections
    const sections = {};
    chunks.forEach((chunk) => {
      const section = chunk.metadata.sectionTitle || "Unknown";
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push({
        content: chunk.content,
        score: chunk.score,
      });
    });

    res.json({
      success: true,
      fileId: fileId,
      documentType: chunks[0].metadata.documentType,
      sections: sections,
      totalChunks: chunks.length,
    });
  } catch (error) {
    Logger.error("Error getting context:", error);
    res.status(500).json({
      error: "Failed to get context",
      message: error.message,
    });
  }
});

/**
 * POST /api/chat/compare
 * Compare multiple documents
 */
router.post("/compare", async (req, res) => {
  try {
    const { fileIds, comparisonType } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length < 2) {
      return res.status(400).json({
        error: "At least two file IDs are required for comparison",
      });
    }

    // Get chunks for each file
    const fileChunks = {};
    for (const fileId of fileIds) {
      const chunks = await vectorDBService.searchByFileId(fileId, 10);
      fileChunks[fileId] = chunks;
    }

    // Generate comparison using chat service
    const comparisonPrompt = `Compare the following documents (${
      comparisonType || "general comparison"
    }):\n\n`;
    const context = Object.entries(fileChunks)
      .map(([fileId, chunks]) => {
        return `Document ${fileId}:\n${chunks
          .map((chunk) => chunk.content)
          .join("\n")}\n`;
      })
      .join("\n");

    const result = await chatService.chatWithPDF(
      comparisonPrompt + context,
      null,
      []
    );

    res.json({
      success: true,
      comparison: result.response,
      filesCompared: fileIds,
      comparisonType: comparisonType || "general",
    });
  } catch (error) {
    Logger.error("Error comparing documents:", error);
    res.status(500).json({
      error: "Document comparison failed",
      message: error.message,
    });
  }
});

module.exports = router;
