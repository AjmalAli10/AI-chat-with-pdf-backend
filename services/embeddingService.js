const { InferenceClient } = require("@huggingface/inference");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");

dotenv.config();

class EmbeddingService {
  constructor() {
    this.huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
    this.embeddingModel =
      process.env.EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
    this.maxChunkSize = 512;
    this.overlapSize = 50;
    this.client = new InferenceClient(this.huggingfaceApiKey);
  }

  /**
   * Step 5: Chunk and Embed the JSON
   */
  async chunkAndEmbed(structuredData, fileId, signal = null) {
    const chunks = this.createChunks(structuredData);
    const embeddings = await this.generateEmbeddings(chunks, signal);

    return chunks.map((chunk, index) => ({
      id: uuidv4(), // Use UUID instead of fileId_chunk_index
      content: chunk.content,
      metadata: {
        ...chunk.metadata,
        fileId,
        chunkIndex: index,
        embeddingModel: this.embeddingModel,
      },
      embedding: embeddings[index],
    }));
  }

  /**
   * Create chunks from structured data
   */
  createChunks(structuredData) {
    const chunks = [];

    // Add document-level information
    chunks.push({
      content: `Document Type: ${structuredData.documentType}. ${
        structuredData.summary || ""
      }`,
      metadata: {
        section: "document_info",
        documentType: structuredData.documentType,
        totalSections: structuredData.sections.length,
        totalPages: structuredData.pages?.length || 0,
      },
    });

    // Process each page separately for page-wise queries
    if (structuredData.pages && structuredData.pages.length > 0) {
      structuredData.pages.forEach((page, pageIndex) => {
        if (page.text && page.text.trim()) {
          const pageChunks = this.chunkPage(page, pageIndex);
          chunks.push(...pageChunks);
        }
      });
    }

    // Process each section
    structuredData.sections.forEach((section, sectionIndex) => {
      const sectionChunks = this.chunkSection(section, sectionIndex);
      chunks.push(...sectionChunks);
    });

    // Add suggestions if available
    if (structuredData.suggestions && structuredData.suggestions.length > 0) {
      chunks.push({
        content: `Suggestions: ${structuredData.suggestions.join(". ")}`,
        metadata: {
          section: "suggestions",
          documentType: structuredData.documentType,
        },
      });
    }

    // Add explanations if available
    if (structuredData.explanations) {
      Object.entries(structuredData.explanations).forEach(
        ([key, explanation]) => {
          chunks.push({
            content: `${
              key.charAt(0).toUpperCase() + key.slice(1)
            }: ${explanation}`,
            metadata: {
              section: "explanations",
              explanationType: key,
              documentType: structuredData.documentType,
            },
          });
        }
      );
    }

    return chunks;
  }

  /**
   * Chunk a page into smaller pieces
   */
  chunkPage(page, pageIndex) {
    const chunks = [];
    const content = page.text;
    const words = content.split(/\s+/);

    // If content is short enough, keep it as one chunk
    if (words.length <= this.maxChunkSize) {
      chunks.push({
        content: `Page ${page.pageNumber}: ${content}`,
        metadata: {
          section: "page_content",
          pageNumber: page.pageNumber,
          pageIndex: pageIndex,
          wordCount: words.length,
          chunkType: "page",
        },
      });
    } else {
      // Split into overlapping chunks
      for (
        let i = 0;
        i < words.length;
        i += this.maxChunkSize - this.overlapSize
      ) {
        const chunkWords = words.slice(i, i + this.maxChunkSize);
        const chunkContent = chunkWords.join(" ");

        chunks.push({
          content: `Page ${page.pageNumber} (Part ${
            Math.floor(i / (this.maxChunkSize - this.overlapSize)) + 1
          }): ${chunkContent}`,
          metadata: {
            section: "page_content",
            pageNumber: page.pageNumber,
            pageIndex: pageIndex,
            chunkType: "page",
            chunkPart:
              Math.floor(i / (this.maxChunkSize - this.overlapSize)) + 1,
            wordCount: chunkWords.length,
            startWordIndex: i,
          },
        });
      }
    }

    return chunks;
  }

  /**
   * Chunk a section into smaller pieces
   */
  chunkSection(section, sectionIndex) {
    const chunks = [];
    const content = section.content.join(" ");
    const words = content.split(/\s+/);

    // If content is short enough, keep it as one chunk
    if (words.length <= this.maxChunkSize) {
      chunks.push({
        content: `${section.title}: ${content}`,
        metadata: {
          section: "section_content",
          sectionTitle: section.title,
          sectionIndex,
          wordCount: words.length,
          chunkType: "section",
        },
      });
    } else {
      // Split into overlapping chunks
      for (
        let i = 0;
        i < words.length;
        i += this.maxChunkSize - this.overlapSize
      ) {
        const chunkWords = words.slice(i, i + this.maxChunkSize);
        const chunkContent = chunkWords.join(" ");

        chunks.push({
          content: `${section.title} (Part ${
            Math.floor(i / (this.maxChunkSize - this.overlapSize)) + 1
          }): ${chunkContent}`,
          metadata: {
            section: "section_content",
            sectionTitle: section.title,
            sectionIndex,
            chunkType: "section",
            chunkPart:
              Math.floor(i / (this.maxChunkSize - this.overlapSize)) + 1,
            wordCount: chunkWords.length,
            startWordIndex: i,
          },
        });
      }
    }

    return chunks;
  }

  /**
   * Generate embeddings for chunks using Hugging Face API
   */
  async generateEmbeddings(chunks, signal = null) {
    const embeddings = [];

    // Process chunks in batches to avoid overwhelming the API
    const batchSize = 5;

    for (let i = 0; i < chunks.length; i += batchSize) {
      // Check if request was aborted
      if (signal && signal.aborted) {
        console.log("❌ Embedding generation aborted by client");
        throw new Error("Request aborted by client");
      }

      const batch = chunks.slice(i, i + batchSize);
      const batchTexts = batch.map((chunk) => chunk.content);

      try {
        console.log(
          `📊 Generating embeddings for batch ${
            Math.floor(i / batchSize) + 1
          }/${Math.ceil(chunks.length / batchSize)}`
        );

        // Batch the API calls
        const batchEmbeddings = await this.getBatchEmbeddings(batchTexts);

        // Add the embeddings to our results
        for (let j = 0; j < batchEmbeddings.length; j++) {
          embeddings.push(batchEmbeddings[j]);
        }

        // Add a small delay between batches to be respectful to the API
        if (i + batchSize < chunks.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error("Error generating embeddings for batch:", error.message);
        // Use fallback embeddings for this batch
        for (let j = 0; j < batch.length; j++) {
          embeddings.push(new Array(384).fill(0.1));
        }
      }
    }

    return embeddings;
  }

  /**
   * Get embeddings for multiple texts in a single API call
   */
  async getBatchEmbeddings(texts) {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("API request timeout")), 30000); // 30 second timeout
      });

      const apiPromise = this.client.featureExtraction({
        model: this.embeddingModel,
        inputs: texts,
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);

      // Handle different response formats
      if (Array.isArray(response)) {
        return response;
      } else if (response && Array.isArray(response[0])) {
        return response;
      } else {
        // If we get a single embedding, wrap it in an array
        return [response];
      }
    } catch (error) {
      console.error("Error getting batch embeddings:", error.message);
      // Return fallback embeddings
      return texts.map(() => new Array(384).fill(0.1));
    }
  }

  /**
   * Get embedding for a single text using feature extraction
   */
  async getEmbedding(text) {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("API request timeout")), 30000); // 30 second timeout
      });

      const apiPromise = this.client.featureExtraction({
        model: this.embeddingModel,
        inputs: text,
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);

      // Return the first embedding if it's an array
      if (Array.isArray(response)) {
        return response[0];
      }
      return response;
    } catch (error) {
      console.error("Error getting embedding:", error.message);
      // Return a simple fallback embedding to avoid breaking the system
      return new Array(384).fill(0.1); // Default embedding size for all-MiniLM-L6-v2
    }
  }

  /**
   * Generate embeddings for search queries
   */
  async getQueryEmbedding(query) {
    return await this.getEmbedding(query);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  calculateSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Find similar chunks based on embedding similarity
   */
  findSimilarChunks(queryEmbedding, storedChunks, topK = 5) {
    const similarities = storedChunks.map((chunk) => ({
      chunk,
      similarity: this.calculateSimilarity(queryEmbedding, chunk.embedding),
    }));

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, topK);
  }
}

module.exports = new EmbeddingService();
