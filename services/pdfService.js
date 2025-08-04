const pdfParse = require("pdf-parse");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const { InferenceClient } = require("@huggingface/inference");
const { put } = require("@vercel/blob");

dotenv.config();

class PDFService {
  constructor() {
    this.huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
    this.nerModel = process.env.NER_MODEL || "dslim/bert-base-NER";
    this.inferenceClient = new InferenceClient(this.huggingfaceApiKey);
  }

  /**
   * Step 1: PDF Upload and Storage using Vercel Blob
   */
  async uploadPDF(file) {
    const fileId = uuidv4();
    const fileName = `${fileId}_${file.originalname}`;

    try {
      // Upload to Vercel Blob
      const blob = await put(fileName, file.buffer, {
        access: "public",
        addRandomSuffix: false,
      });

      return {
        fileId,
        fileName,
        blobUrl: blob.url,
        originalName: file.originalname,
        size: file.size,
      };
    } catch (error) {
      console.error("Error uploading to Vercel Blob:", error);
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }
  }

  /**
   * Step 2: PDF Parsing - Page-wise Text Extraction
   */
  async parsePDF(fileBuffer) {
    try {
      const data = await pdfParse(fileBuffer, {
        // Enable page-by-page parsing
        max: 0, // Parse all pages
        version: "v2.0.550",
      });

      // Extract text page by page
      const pages = [];
      const fullText = data.text || "";

      // Split text by pages using pdf-parse's page info
      if (data.pages && data.pages.length > 0) {
        // If pdf-parse provides page information
        data.pages.forEach((page, index) => {
          pages.push({
            pageNumber: index + 1,
            text: page.text || "",
            layout: {
              words: [],
              lines: [],
              tables: [],
            },
            width: page.width || 612,
            height: page.height || 792,
            wordCount: (page.text || "").split(/\s+/).length,
          });
        });
      } else {
        // Fallback: Split text into pages based on estimated page length
        const estimatedPageLength = Math.ceil(
          fullText.length / Math.max(data.numpages || 1, 1)
        );
        const textChunks = this.splitTextIntoPages(
          fullText,
          estimatedPageLength,
          data.numpages || 1
        );

        textChunks.forEach((pageText, index) => {
          pages.push({
            pageNumber: index + 1,
            text: pageText,
            layout: {
              words: [],
              lines: [],
              tables: [],
            },
            width: 612,
            height: 792,
            wordCount: pageText.split(/\s+/).length,
          });
        });
      }

      return {
        totalPages: pages.length,
        pages: pages,
        rawText: fullText,
        numpages: data.numpages || pages.length,
        info: data.info || {},
      };
    } catch (error) {
      console.error("Error parsing PDF:", error);
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Split text into pages based on estimated page length
   */
  splitTextIntoPages(text, estimatedPageLength, numPages) {
    const pages = [];
    const lines = text.split("\n");
    let currentPage = [];
    let currentLength = 0;
    const targetLength = estimatedPageLength;

    for (const line of lines) {
      currentPage.push(line);
      currentLength += line.length + 1; // +1 for newline

      if (currentLength >= targetLength && pages.length < numPages - 1) {
        pages.push(currentPage.join("\n"));
        currentPage = [];
        currentLength = 0;
      }
    }

    // Add the last page
    if (currentPage.length > 0) {
      pages.push(currentPage.join("\n"));
    }

    // Ensure we have the right number of pages
    while (pages.length < numPages) {
      pages.push("");
    }

    return pages.slice(0, numPages);
  }

  /**
   * Extract layout data from PDF page
   * Note: pdf-parse doesn't provide detailed layout information
   * This is a simplified version for compatibility
   */
  async extractLayoutData(page) {
    // pdf-parse doesn't provide detailed layout data
    // Return empty layout for compatibility
    return {
      words: [],
      lines: [],
      tables: [],
    };
  }

  /**
   * Step 3: Structured Extraction via NER Model
   */
  async extractStructuredData(pdfData) {
    try {
      if (!this.huggingfaceApiKey) {
        console.warn("No Hugging Face API key provided, using fallback method");
        return this.fallbackStructuredExtraction(pdfData);
      }

      console.log("🔍 Using NER model for document understanding...");

      // Extract entities from the text using NER
      const entities = await this.extractEntities(pdfData.rawText);

      // Process the entities to create structured data
      const structuredData = this.processNERResponse(entities, pdfData);

      console.log("✅ NER processing completed");
      return structuredData;
    } catch (error) {
      console.error("Error in structured extraction:", error.message);
      console.log("🔄 Falling back to basic text processing");
      return this.fallbackStructuredExtraction(pdfData);
    }
  }

  /**
   * Extract entities from text using NER model
   */
  async extractEntities(text) {
    try {
      const output = await this.inferenceClient.tokenClassification({
        model: this.nerModel,
        inputs: text,
        provider: "auto",
      });

      return output;
    } catch (error) {
      console.error("Error extracting entities:", error);
      return [];
    }
  }

  /**
   * Process NER response to create structured data
   */
  processNERResponse(entities, pdfData) {
    try {
      // Group entities by type
      const entityGroups = this.groupEntitiesByType(entities);

      // Extract sections based on entities and text structure
      const sections = this.extractSectionsFromEntities(
        entities,
        pdfData.rawText
      );

      return {
        documentType: this.classifyDocumentType(pdfData.rawText),
        sections: sections,
        pages: pdfData.pages,
        entities: entityGroups,
        layout: {
          words: entities.map((entity) => ({
            text: entity.word,
            label: entity.entity_group,
            score: entity.score,
          })),
          sections: sections,
        },
        metadata: {
          totalPages: pdfData.totalPages,
          wordCount: entities.length,
          extractedAt: new Date().toISOString(),
          modelUsed: this.nerModel,
        },
        confidence: this.calculateConfidence(entities),
      };
    } catch (error) {
      console.error("Error processing NER response:", error);
      return this.fallbackStructuredExtraction(pdfData);
    }
  }

  /**
   * Group entities by their type (PERSON, ORG, DATE, etc.)
   */
  groupEntitiesByType(entities) {
    const groups = {};

    entities.forEach((entity) => {
      const type = entity.entity_group;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push({
        text: entity.word,
        score: entity.score,
        start: entity.start,
        end: entity.end,
      });
    });

    return groups;
  }

  /**
   * Extract sections from entities and text
   */
  extractSectionsFromEntities(entities, text) {
    const sections = [];
    const lines = text.split("\n").filter((line) => line.trim());

    let currentSection = { title: "Content", content: [] };

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // Check if line contains section headers
      if (this.isSectionHeader(trimmedLine)) {
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { title: trimmedLine, content: [] };
      } else {
        // Check if line contains entities
        const lineEntities = entities.filter((entity) =>
          text.substring(entity.start, entity.end).includes(trimmedLine)
        );

        if (lineEntities.length > 0) {
          currentSection.content.push({
            text: trimmedLine,
            entities: lineEntities.map((entity) => ({
              text: entity.word,
              type: entity.entity_group,
              score: entity.score,
            })),
          });
        } else {
          currentSection.content.push(trimmedLine);
        }
      }
    });

    if (currentSection.content.length > 0) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Check if line is a section header
   */
  isSectionHeader(line) {
    const trimmed = line.trim();
    return (
      trimmed.length < 100 &&
      (trimmed.toUpperCase() === trimmed ||
        /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed))
    );
  }

  /**
   * Calculate confidence based on entity scores
   */
  calculateConfidence(entities) {
    if (entities.length === 0) return 0.0;

    const avgScore =
      entities.reduce((sum, entity) => sum + entity.score, 0) / entities.length;
    return Math.round(avgScore * 100) / 100;
  }

  /**
   * Combine results from all pages
   */
  combineLayoutResults(processedPages, pdfData) {
    const allWords = [];
    const allSections = [];
    let totalConfidence = 0;

    processedPages.forEach((page) => {
      allWords.push(...page.layout.words);
      allSections.push(...page.layout.sections);
      totalConfidence += page.confidence;
    });

    const averageConfidence = totalConfidence / processedPages.length;

    return {
      documentType: this.classifyDocumentType(pdfData.rawText),
      sections: this.mergeSections(allSections),
      pages: processedPages,
      layout: {
        words: allWords,
        sections: allSections,
        tables: processedPages.flatMap((page) => page.layout.tables),
      },
      metadata: {
        totalPages: pdfData.totalPages,
        wordCount: allWords.length,
        extractedAt: new Date().toISOString(),
        modelUsed: "fallback",
      },
      confidence: averageConfidence,
    };
  }

  /**
   * Merge sections from different pages
   */
  mergeSections(sections) {
    const merged = {};

    sections.forEach((section) => {
      const title = section.title.toLowerCase();
      if (!merged[title]) {
        merged[title] = { title: section.title, content: [] };
      }
      merged[title].content.push(...section.content);
    });

    return Object.values(merged);
  }

  /**
   * Process Hugging Face model output
   */
  processModelOutput(modelOutput, pdfData) {
    // This is a simplified version - in practice, you'd use a more sophisticated approach
    const sections = this.identifySections(pdfData.rawText);

    return {
      documentType: this.classifyDocumentType(pdfData.rawText),
      sections: sections,
      pages: pdfData.pages, // Include page information
      metadata: {
        totalPages: pdfData.totalPages,
        wordCount: pdfData.rawText.split(/\s+/).length,
        extractedAt: new Date().toISOString(),
      },
      confidence: modelOutput.confidence || 0.8,
    };
  }

  /**
   * Fallback structured extraction when model fails
   */
  fallbackStructuredExtraction(pdfData) {
    const sections = this.identifySections(pdfData.rawText);

    return {
      documentType: this.classifyDocumentType(pdfData.rawText),
      sections: sections,
      pages: pdfData.pages, // Include page information
      metadata: {
        totalPages: pdfData.totalPages,
        wordCount: pdfData.rawText.split(/\s+/).length,
        extractedAt: new Date().toISOString(),
      },
      confidence: 0.6,
    };
  }

  /**
   * Identify document sections
   */
  identifySections(text) {
    const sections = [];
    const lines = text.split("\n").filter((line) => line.trim());

    let currentSection = { title: "Introduction", content: [] };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Simple section detection based on formatting
      if (
        trimmedLine.length < 100 &&
        (trimmedLine.toUpperCase() === trimmedLine ||
          /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmedLine))
      ) {
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
        }

        currentSection = {
          title: trimmedLine,
          content: [],
        };
      } else {
        currentSection.content.push(trimmedLine);
      }
    }

    if (currentSection.content.length > 0) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Classify document type
   */
  classifyDocumentType(text) {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("resume") ||
      lowerText.includes("cv") ||
      (lowerText.includes("experience") && lowerText.includes("education"))
    ) {
      return "resume";
    } else if (
      lowerText.includes("invoice") ||
      lowerText.includes("bill") ||
      (lowerText.includes("total") && lowerText.includes("amount"))
    ) {
      return "invoice";
    } else if (
      lowerText.includes("abstract") ||
      lowerText.includes("introduction") ||
      lowerText.includes("references") ||
      lowerText.includes("methodology")
    ) {
      return "research_paper";
    } else if (
      lowerText.includes("contract") ||
      lowerText.includes("agreement") ||
      (lowerText.includes("terms") && lowerText.includes("conditions"))
    ) {
      return "contract";
    } else {
      return "general";
    }
  }

  /**
   * Step 4: Post-process the JSON
   */
  async postProcessStructuredData(structuredData) {
    const processedData = { ...structuredData };

    // Add improvement suggestions for resumes
    if (processedData.documentType === "resume") {
      processedData.suggestions = this.generateResumeSuggestions(processedData);
    }

    // Add explanations for research papers
    if (processedData.documentType === "research_paper") {
      processedData.explanations =
        this.generateResearchExplanations(processedData);
    }

    // Summarize long content
    processedData.summary = this.generateSummary(processedData);

    return processedData;
  }

  /**
   * Generate resume improvement suggestions
   */
  generateResumeSuggestions(data) {
    const suggestions = [];

    data.sections.forEach((section) => {
      if (section.title.toLowerCase().includes("experience")) {
        if (section.content.length < 3) {
          suggestions.push(
            "Consider adding more detail to your work experience"
          );
        }
      }

      if (section.title.toLowerCase().includes("skills")) {
        if (section.content.length < 5) {
          suggestions.push("Consider adding more technical skills");
        }
      }
    });

    return suggestions;
  }

  /**
   * Generate research paper explanations
   */
  generateResearchExplanations(data) {
    const explanations = {};

    data.sections.forEach((section) => {
      if (section.title.toLowerCase().includes("methodology")) {
        explanations.methodology =
          "This section describes the research methods and procedures used in the study.";
      }

      if (section.title.toLowerCase().includes("results")) {
        explanations.results =
          "This section presents the findings and outcomes of the research.";
      }
    });

    return explanations;
  }

  /**
   * Generate document summary
   */
  generateSummary(data) {
    const totalContent = data.sections
      .map((s) => s.content.join(" "))
      .join(" ");
    const words = totalContent.split(/\s+/);

    if (words.length > 100) {
      return `This document contains ${data.sections.length} main sections with approximately ${words.length} words.`;
    } else {
      return `This document contains ${data.sections.length} main sections.`;
    }
  }

  /**
   * Complete PDF processing pipeline
   */
  async processPDF(file, signal = null) {
    try {
      // Check if request was aborted
      if (signal && signal.aborted) {
        console.log("❌ PDF processing aborted by client");
        throw new Error("Request aborted by client");
      }

      // Step 1: Upload
      const uploadResult = await this.uploadPDF(file);

      // Check if request was aborted after upload
      if (signal && signal.aborted) {
        console.log("❌ PDF processing aborted after upload");
        throw new Error("Request aborted by client");
      }

      // Step 2: Parse
      const parsedData = await this.parsePDF(file.buffer);

      // Check if request was aborted after parsing
      if (signal && signal.aborted) {
        console.log("❌ PDF processing aborted after parsing");
        throw new Error("Request aborted by client");
      }

      // Step 3: Structured extraction
      const structuredData = await this.extractStructuredData(parsedData);

      // Check if request was aborted after structured extraction
      if (signal && signal.aborted) {
        console.log("❌ PDF processing aborted after structured extraction");
        throw new Error("Request aborted by client");
      }

      // Step 4: Post-process
      const processedData = await this.postProcessStructuredData(
        structuredData
      );

      return {
        fileId: uploadResult.fileId,
        fileName: uploadResult.fileName,
        originalName: uploadResult.originalName,
        parsedData,
        structuredData: processedData,
        blobUrl: uploadResult.blobUrl,
      };
    } catch (error) {
      console.error("Error processing PDF:", error);
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }
}

module.exports = new PDFService();
