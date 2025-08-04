const { QdrantClient } = require("@qdrant/js-client-rest");
const dotenv = require("dotenv");

dotenv.config();

class VectorDBService {
  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY,
    });

    this.collectionName = "pdf_chunks";
    this.vectorSize = 384; // Default for all-MiniLM-L6-v2
  }

  /**
   * Step 6: Store in Vector DB
   */
  async initializeCollection() {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === this.collectionName
      );

      if (!collectionExists) {
        await this.createCollection();
      }

      return true;
    } catch (error) {
      console.error("Error initializing collection:", error);
      throw error;
    }
  }

  /**
   * Create the collection with proper configuration
   */
  async createCollection() {
    try {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: "Cosine",
        },
      });

      // Create payload index for efficient filtering
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: "fileId",
        field_schema: "keyword",
      });

      await this.client.createPayloadIndex(this.collectionName, {
        field_name: "documentType",
        field_schema: "keyword",
      });

      await this.client.createPayloadIndex(this.collectionName, {
        field_name: "section",
        field_schema: "keyword",
      });

      console.log(
        `✅ Collection '${this.collectionName}' created successfully`
      );
    } catch (error) {
      console.error("Error creating collection:", error);
      throw error;
    }
  }

  /**
   * Store embeddings in Qdrant
   */
  async storeEmbeddings(embeddings, signal = null) {
    try {
      // Check if request was aborted
      if (signal && signal.aborted) {
        console.log("❌ Vector storage aborted by client");
        throw new Error("Request aborted by client");
      }

      const points = embeddings.map((embedding) => ({
        id: embedding.id,
        vector: embedding.embedding,
        payload: {
          content: embedding.content,
          fileId: embedding.metadata.fileId,
          documentType: embedding.metadata.documentType,
          section: embedding.metadata.section,
          sectionTitle: embedding.metadata.sectionTitle,
          chunkIndex: embedding.metadata.chunkIndex,
          wordCount: embedding.metadata.wordCount,
          embeddingModel: embedding.metadata.embeddingModel,
          uploadedAt: new Date().toISOString(),
          // Add page-specific metadata
          pageNumber: embedding.metadata.pageNumber,
          pageIndex: embedding.metadata.pageIndex,
          chunkType: embedding.metadata.chunkType,
          chunkPart: embedding.metadata.chunkPart,
        },
      }));

      await this.client.upsert(this.collectionName, {
        points: points,
      });

      console.log(`✅ Stored ${points.length} embeddings in Qdrant`);
      return points.length;
    } catch (error) {
      console.error("Error storing embeddings:", error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async searchSimilar(queryEmbedding, limit = 5, filter = null) {
    try {
      // Ensure queryEmbedding is an array
      if (!Array.isArray(queryEmbedding)) {
        console.error(
          "Error: queryEmbedding is not an array:",
          typeof queryEmbedding
        );
        return [];
      }

      // Check if queryEmbedding is a zero vector (all zeros)
      const isZeroVector = queryEmbedding.every((val) => val === 0);

      if (isZeroVector && !filter) {
        // If it's a zero vector and no filter, we can't do a meaningful search
        console.warn(
          "Warning: Zero vector provided without filter, returning empty results"
        );
        return [];
      }

      const searchParams = {
        vector: queryEmbedding,
        limit: limit,
        with_payload: true,
        with_vector: false,
      };

      if (filter) {
        searchParams.filter = filter;
      }

      console.log(`🔍 Searching with params:`, {
        vectorSize: queryEmbedding.length,
        limit: limit,
        hasFilter: !!filter,
        isZeroVector: isZeroVector,
      });

      const results = await this.client.search(
        this.collectionName,
        searchParams
      );

      return results.map((result) => ({
        id: result.id,
        score: result.score,
        content: result.payload.content,
        metadata: {
          fileId: result.payload.fileId,
          documentType: result.payload.documentType,
          section: result.payload.section,
          sectionTitle: result.payload.sectionTitle,
          chunkIndex: result.payload.chunkIndex,
          wordCount: result.payload.wordCount,
        },
      }));
    } catch (error) {
      console.error("Error searching vectors:", error);
      throw error;
    }
  }

  /**
   * Search by file ID and page number
   */
  async searchByFileIdAndPage(fileId, pageNumber, limit = 10) {
    try {
      console.log(
        `🔍 Searching for fileId: ${fileId}, pageNumber: ${pageNumber}`
      );

      const filter = {
        must: [
          {
            key: "fileId",
            match: { value: fileId },
          },
          {
            key: "pageNumber",
            match: { value: pageNumber },
          },
        ],
      };

      console.log(`🔍 Using filter:`, JSON.stringify(filter, null, 2));

      // Get all points for this file and page using scroll
      const scrollResults = await this.client.scroll(this.collectionName, {
        filter: filter,
        limit: limit,
        with_payload: true,
        with_vector: false,
      });

      console.log(
        `🔍 Scroll results: ${scrollResults.points.length} points found`
      );

      // Debug: Show some sample points to understand the data structure
      if (scrollResults.points.length > 0) {
        const samplePoint = scrollResults.points[0];
        console.log(`🔍 Sample point payload:`, {
          fileId: samplePoint.payload.fileId,
          pageNumber: samplePoint.payload.pageNumber,
          content: samplePoint.payload.content.substring(0, 100),
        });
      }

      return scrollResults.points.map((point) => ({
        id: point.id,
        score: 1.0, // All points from same page have equal relevance
        content: point.payload.content,
        metadata: {
          fileId: point.payload.fileId,
          documentType: point.payload.documentType,
          section: point.payload.section,
          sectionTitle: point.payload.sectionTitle,
          chunkIndex: point.payload.chunkIndex,
          wordCount: point.payload.wordCount,
          pageNumber: point.payload.pageNumber,
          pageIndex: point.payload.pageIndex,
          chunkType: point.payload.chunkType,
          chunkPart: point.payload.chunkPart,
        },
      }));
    } catch (error) {
      console.error("Error searching by file ID and page:", error);
      return [];
    }
  }

  /**
   * Search by file ID
   */
  async searchByFileId(fileId, limit = 10) {
    try {
      // Use a simple query to get all points for this file
      const filter = {
        must: [
          {
            key: "fileId",
            match: { value: fileId },
          },
        ],
      };

      // Get all points for this file using scroll instead of search
      const scrollResults = await this.client.scroll(this.collectionName, {
        filter: filter,
        limit: limit,
        with_payload: true,
        with_vector: false,
      });

      return scrollResults.points.map((point) => ({
        id: point.id,
        score: 1.0, // All points from same file have equal relevance
        content: point.payload.content,
        metadata: {
          fileId: point.payload.fileId,
          documentType: point.payload.documentType,
          section: point.payload.section,
          sectionTitle: point.payload.sectionTitle,
          chunkIndex: point.payload.chunkIndex,
          wordCount: point.payload.wordCount,
          pageNumber: point.payload.pageNumber,
          pageIndex: point.payload.pageIndex,
          chunkType: point.payload.chunkType,
          chunkPart: point.payload.chunkPart,
        },
      }));
    } catch (error) {
      console.error("Error searching by file ID:", error);
      return [];
    }
  }

  /**
   * Search by document type
   */
  async searchByDocumentType(documentType, limit = 10) {
    try {
      const filter = {
        must: [
          {
            key: "documentType",
            match: { value: documentType },
          },
        ],
      };

      // Use a dummy vector for filtering (we're filtering by documentType anyway)
      const dummyVector = new Array(this.vectorSize).fill(0.1);

      return await this.searchSimilar(dummyVector, limit, filter);
    } catch (error) {
      console.error("Error searching by document type:", error);
      return [];
    }
  }

  /**
   * Delete embeddings by file ID
   */
  async deleteByFileId(fileId) {
    try {
      const filter = {
        must: [
          {
            key: "fileId",
            match: { value: fileId },
          },
        ],
      };

      await this.client.delete(this.collectionName, {
        filter: filter,
      });

      console.log(`✅ Deleted embeddings for file: ${fileId}`);
      return true;
    } catch (error) {
      console.error("Error deleting embeddings:", error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionInfo() {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        name: info.name,
        vectorSize: info.config.params.vectors.size,
        distance: info.config.params.vectors.distance,
        pointsCount: info.points_count,
        segmentsCount: info.segments_count,
      };
    } catch (error) {
      console.error("Error getting collection info:", error);
      throw error;
    }
  }

  /**
   * Get all files in the database
   */
  async getAllFiles() {
    try {
      const results = await this.client.scroll(this.collectionName, {
        limit: 1000,
        with_payload: true,
        with_vector: false,
      });

      const files = new Map();

      results.points.forEach((point) => {
        const fileId = point.payload.fileId;
        if (!files.has(fileId)) {
          files.set(fileId, {
            fileId: fileId,
            documentType: point.payload.documentType,
            chunksCount: 0,
            uploadedAt: point.payload.uploadedAt,
          });
        }
        files.get(fileId).chunksCount++;
      });

      return Array.from(files.values());
    } catch (error) {
      console.error("Error getting all files:", error);
      throw error;
    }
  }

  /**
   * Health check for Qdrant
   */
  async healthCheck() {
    try {
      await this.client.getCollections();
      return { status: "healthy", timestamp: new Date().toISOString() };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

module.exports = new VectorDBService();
