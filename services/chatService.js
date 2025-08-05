const embeddingService = require("./embeddingService");
const vectorDBService = require("./vectorDBService");
const { InferenceClient } = require("@huggingface/inference");
const dotenv = require("dotenv");

dotenv.config();

class ChatService {
  constructor() {
    this.huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;

    // Model configuration from environment variables
    this.primaryModel = process.env.PRIMARY_MODEL || "Qwen/Qwen2-7B-Instruct";
    this.fallbackModel1 = process.env.FALLBACK_MODEL_1 || "zai-org/GLM-4.5";
    this.fallbackModel2 =
      process.env.FALLBACK_MODEL_2 || "microsoft/DialoGPT-medium";

    if (!this.huggingfaceApiKey) {
      throw new Error("HUGGINGFACE_API_KEY is required");
    }

    this.client = new InferenceClient(this.huggingfaceApiKey);
  }

  /**
   * Step 7: Chat with PDF
   */
  async chatWithPDF(query, fileId = null, chatHistory = []) {
    try {
      let relevantChunks = [];
      let isPageSpecific = false;
      let targetPage = null;

      // Check if this is a page-specific query
      const pageQueryResult = this.detectPageSpecificQuery(query);
      if (pageQueryResult.isPageSpecific && fileId) {
        isPageSpecific = true;
        targetPage = pageQueryResult.pageNumber;
        console.log(`📄 Page-specific query detected for page ${targetPage}`);

        // Get chunks for specific page
        relevantChunks = await vectorDBService.searchByFileIdAndPage(
          fileId,
          targetPage,
          10
        );

        if (relevantChunks.length === 0) {
          return {
            response: `I couldn't find any content on page ${targetPage}. The document might not have that many pages, or the page might be empty.`,
            context: {
              chunksUsed: 0,
              topChunk: "No content found",
              confidence: 0,
              isPageSpecific: true,
              targetPage: targetPage,
            },
            metadata: {
              query: query,
              fileId: fileId,
              timestamp: new Date().toISOString(),
            },
          };
        }
      } else if (fileId) {
        // Chat with specific PDF - get all chunks from that file
        console.log(`💬 Chatting with specific PDF: ${fileId}`);
        relevantChunks = await vectorDBService.searchByFileId(fileId, 10);
      } else {
        // Chat with all PDFs - use semantic search
        console.log(`💬 Chatting with all PDFs using semantic search`);
        const queryEmbedding = await embeddingService.getQueryEmbedding(query);
        relevantChunks = await vectorDBService.searchSimilar(queryEmbedding, 5);
      }

      // Build context from relevant chunks
      const context = this.buildContext(
        relevantChunks,
        fileId,
        isPageSpecific,
        targetPage
      );

      // Generate response using AI models
      const response = await this.generateResponse(query, context, chatHistory);

      return {
        response: response,
        context: {
          chunksUsed: relevantChunks.length,
          topChunk: relevantChunks[0]?.content?.substring(0, 200) + "...",
          confidence: relevantChunks[0]?.score || 0,
          isPageSpecific: isPageSpecific,
          targetPage: targetPage,
        },
        metadata: {
          query: query,
          fileId: fileId,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Error in chat:", error);
      throw new Error(`Chat failed: ${error.message}`);
    }
  }

  /**
   * Detect if a query is asking about a specific page
   */
  detectPageSpecificQuery(query) {
    const lowerQuery = query.toLowerCase();

    // Patterns to detect page-specific queries
    const pagePatterns = [
      /page\s+(\d+)/i, // "page 5", "Page 3"
      /the\s+(\d+)(?:st|nd|rd|th)?\s+page/i, // "the 5th page", "the 3rd page"
      /page\s+number\s+(\d+)/i, // "page number 5"
      /(\d+)(?:st|nd|rd|th)?\s+page/i, // "5th page", "3rd page"
    ];

    for (const pattern of pagePatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        const pageNumber = parseInt(match[1]);
        if (pageNumber > 0) {
          return {
            isPageSpecific: true,
            pageNumber: pageNumber,
          };
        }
      }
    }

    return {
      isPageSpecific: false,
      pageNumber: null,
    };
  }

  /**
   * Build context from relevant chunks
   */
  buildContext(chunks, fileId, isPageSpecific = false, targetPage = null) {
    if (chunks.length === 0) {
      if (isPageSpecific) {
        return `No content found on page ${targetPage}. The page might be empty or the document might not have that many pages.`;
      }
      return "No relevant information found in the uploaded documents.";
    }

    let context = "Based on the following information from the document:\n\n";

    if (isPageSpecific) {
      context = `Based on the following information from page ${targetPage}:\n\n`;
    }

    chunks.forEach((chunk, index) => {
      context += `${index + 1}. ${chunk.content}\n\n`;
    });

    if (fileId) {
      if (isPageSpecific) {
        context += `\nThis information is from page ${targetPage} of a specific document (ID: ${fileId}).`;
      } else {
        context += `\nThis information is from a specific document (ID: ${fileId}).`;
      }
    }

    return context;
  }

  /**
   * Generate response using Qwen via Hugging Face Inference client
   */
  async generateResponse(query, context, chatHistory = []) {
    try {
      // Validate client
      if (!this.client) {
        throw new Error("Hugging Face client not initialized");
      }

      // Build messages array
      const messages = [
        {
          role: "system",
          content: this.getSystemPrompt(),
        },
      ];

      // Add chat history (last 5 messages to avoid token limits)
      const recentHistory = chatHistory.slice(-5);
      messages.push(...recentHistory);

      // Add current query with context
      messages.push({
        role: "user",
        content: `Context: ${context}\n\nUser Question: ${query}`,
      });

      console.log(`📝 Query: ${query.substring(0, 100)}...`);
      console.log(`📊 Context length: ${context.length} characters`);

      // Try models in sequence with individual timeouts
      const models = [
        { name: "Primary Model", model: this.primaryModel },
        { name: "Fallback Model 1", model: this.fallbackModel1 },
        { name: "Fallback Model 2", model: this.fallbackModel2 },
      ];

      for (let i = 0; i < models.length; i++) {
        const { name, model } = models[i];
        try {
          console.log(`🤖 Trying model ${i + 1}/${models.length}: ${name}`);

          // Individual timeout for each model (30 seconds)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error(`Chat API request timeout for ${name}`)),
              30000
            );
          });

          const chatCompletionPromise = this.client.chatCompletion({
            provider: "auto",
            model: model,
            messages: messages,
            max_tokens: 500,
            temperature: 0.7,
            top_p: 0.9,
          });

          const chatCompletion = await Promise.race([
            chatCompletionPromise,
            timeoutPromise,
          ]);

          console.log(`✅ Response generated successfully with ${name}`);

          if (chatCompletion.choices && chatCompletion.choices[0]) {
            const response = chatCompletion.choices[0].message.content;
            return response;
          } else {
            console.error(
              `❌ Invalid response structure from ${name}:`,
              chatCompletion
            );
            throw new Error(`Invalid response from ${name}`);
          }
        } catch (error) {
          console.error(`❌ ${name} failed:`, error.message);

          // If this is the last model, throw the error
          if (i === models.length - 1) {
            throw error;
          }

          // Otherwise, continue to next model
          console.log(`⚠️ Trying next model...`);
        }
      }
    } catch (error) {
      console.error("Error generating response:", error);
      if (error.message.includes("timeout")) {
        console.error(
          "⏰ All models timed out - this might be due to model loading or network issues"
        );
      }
      throw error;
    }
  }

  /**
   * Get system prompt for the AI
   */
  getSystemPrompt() {
    return `You are an intelligent PDF assistant that helps users understand and interact with their uploaded documents. 

Your capabilities include:
- Explaining complex sections of documents
- Providing improvement suggestions for resumes
- Summarizing research papers
- Answering questions about invoices, contracts, and other documents
- Making connections between different parts of the document
- Engaging in general conversation and greetings

Guidelines:
1. For document-related queries: Always base your answers on the provided context from the document
2. For general conversation: Be friendly, helpful, and conversational
3. If the context doesn't contain relevant information for document queries, say so clearly
4. Be helpful, accurate, and concise
5. For resumes, provide constructive feedback and suggestions
6. For research papers, explain complex concepts in simple terms
7. For invoices, help with calculations and clarifications
8. For contracts, explain legal terms and implications

**RESUME-SPECIFIC GUIDELINES:**
- When calculating experience duration, properly interpret date ranges:
  * "Mar 2023 - Present" means the person is currently employed and has been working since March 2023
  * "Present" indicates current employment, not a past end date
  * Calculate experience from the start date to the current date (not to "Present" as if it were a past date)
  * For "Mar 2023 - Present", calculate from March 2023 to current date
- Always consider the current date when calculating experience duration
- For experience calculations, be precise and accurate with time periods
- When analyzing resumes, provide accurate experience assessments

When responding:
- Be conversational but professional
- For general greetings, respond naturally and warmly
- For document queries, provide specific examples when possible
- Ask clarifying questions if the user's query is ambiguous
- Suggest follow-up questions that might be helpful
- Use clear formatting with headers (###) for sections
- Use bullet points for lists
- Keep paragraphs short and readable
- Use **bold** for emphasis and *italic* for important terms

IMPORTANT: When no document context is provided, respond naturally to general conversation without mentioning documents or PDFs.`;
  }

  /**
   * Generate follow-up questions based on document content
   */
  async generateFollowUpQuestions(fileId, documentType) {
    try {
      const chunks = await vectorDBService.searchByFileId(fileId, 10);

      if (chunks.length === 0) {
        return [];
      }

      const context = chunks.map((chunk) => chunk.content).join("\n");

      const messages = [
        {
          role: "system",
          content: `Generate 3-5 relevant follow-up questions based on the document content. 
Focus on the document type: ${documentType}.
Make questions specific and actionable.`,
        },
        {
          role: "user",
          content: `Document content: ${context}\n\nGenerate follow-up questions.`,
        },
      ];

      // Try models in sequence for follow-up questions
      const models = [
        { name: "Primary Model", model: this.primaryModel },
        { name: "Fallback Model 1", model: this.fallbackModel1 },
        { name: "Fallback Model 2", model: this.fallbackModel2 },
      ];

      for (let i = 0; i < models.length; i++) {
        const { name, model } = models[i];
        try {
          console.log(`🤖 Trying ${name} for follow-up questions...`);

          // Individual timeout for each model (20 seconds)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(`Follow-up questions API timeout for ${name}`)
                ),
              20000
            );
          });

          const fetchPromise = fetch(
            "https://router.huggingface.co/v1/chat/completions",
            {
              headers: {
                Authorization: `Bearer ${this.huggingfaceApiKey}`,
                "Content-Type": "application/json",
              },
              method: "POST",
              body: JSON.stringify({
                messages: messages,
                model: model,
                stream: false,
                max_tokens: 300,
                temperature: 0.7,
                top_p: 0.9,
              }),
            }
          );

          const response = await Promise.race([fetchPromise, timeoutPromise]);

          const result = await response.json();

          if (result.choices && result.choices[0]) {
            const questionsText = result.choices[0].message.content.trim();
            const questions = questionsText
              .split("\n")
              .filter((q) => q.trim().length > 0)
              .map((q) => q.replace(/^\d+\.\s*/, "").trim());
            return questions;
          } else {
            throw new Error(`Invalid response from ${name}`);
          }
        } catch (error) {
          console.error(
            `❌ ${name} failed for follow-up questions:`,
            error.message
          );

          // If this is the last model, return empty array
          if (i === models.length - 1) {
            return [];
          }

          // Otherwise, continue to next model
          console.log(`⚠️ Trying next model for follow-up questions...`);
        }
      }
    } catch (error) {
      console.error("Error generating follow-up questions:", error);
      return [];
    }
  }

  /**
   * Analyze document and provide insights
   */
  async analyzeDocument(fileId, documentType) {
    try {
      const chunks = await vectorDBService.searchByFileId(fileId, 15);

      if (chunks.length === 0) {
        return { error: "No document content found" };
      }

      const context = chunks.map((chunk) => chunk.content).join("\n");

      const messages = [
        {
          role: "system",
          content: `Analyze the document and provide insights. Document type: ${documentType}.
Include:
- Key points and findings
- Strengths and areas for improvement
- Recommendations
- Summary`,
        },
        {
          role: "user",
          content: `Analyze this document: ${context}`,
        },
      ];

      // Try models in sequence for document analysis
      const models = [
        { name: "Primary Model", model: this.primaryModel },
        { name: "Fallback Model 1", model: this.fallbackModel1 },
        { name: "Fallback Model 2", model: this.fallbackModel2 },
      ];

      for (let i = 0; i < models.length; i++) {
        const { name, model } = models[i];
        try {
          console.log(`🤖 Trying ${name} for document analysis...`);

          // Individual timeout for each model (30 seconds)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () =>
                reject(new Error(`Document analysis API timeout for ${name}`)),
              30000
            );
          });

          const fetchPromise = fetch(
            "https://router.huggingface.co/v1/chat/completions",
            {
              headers: {
                Authorization: `Bearer ${this.huggingfaceApiKey}`,
                "Content-Type": "application/json",
              },
              method: "POST",
              body: JSON.stringify({
                messages: messages,
                model: model,
                stream: false,
                max_tokens: 600,
                temperature: 0.5,
                top_p: 0.9,
              }),
            }
          );

          const response = await Promise.race([fetchPromise, timeoutPromise]);

          const result = await response.json();

          if (result.choices && result.choices[0]) {
            return {
              analysis: result.choices[0].message.content.trim(),
              chunksAnalyzed: chunks.length,
              documentType: documentType,
            };
          } else {
            throw new Error(`Invalid response from ${name}`);
          }
        } catch (error) {
          console.error(
            `❌ ${name} failed for document analysis:`,
            error.message
          );

          // If this is the last model, throw the error
          if (i === models.length - 1) {
            throw error;
          }

          // Otherwise, continue to next model
          console.log(`⚠️ Trying next model for document analysis...`);
        }
      }
    } catch (error) {
      console.error("Error analyzing document:", error);
      throw error;
    }
  }

  /**
   * Improve specific sections (for resumes)
   */
  async improveSection(fileId, sectionName, improvementType) {
    try {
      const chunks = await vectorDBService.searchByFileId(fileId, 20);

      const sectionChunks = chunks.filter((chunk) =>
        chunk.metadata.sectionTitle
          ?.toLowerCase()
          .includes(sectionName.toLowerCase())
      );

      if (sectionChunks.length === 0) {
        return { error: "Section not found" };
      }

      const sectionContent = sectionChunks
        .map((chunk) => chunk.content)
        .join("\n");

      const messages = [
        {
          role: "system",
          content: `Improve the ${sectionName} section. Focus on: ${improvementType}.
Provide specific suggestions and examples.`,
        },
        {
          role: "user",
          content: `Current ${sectionName}: ${sectionContent}\n\nImprove this section.`,
        },
      ];

      // Try models in sequence for section improvement
      const models = [
        { name: "Primary Model", model: this.primaryModel },
        { name: "Fallback Model 1", model: this.fallbackModel1 },
        { name: "Fallback Model 2", model: this.fallbackModel2 },
      ];

      for (let i = 0; i < models.length; i++) {
        const { name, model } = models[i];
        try {
          console.log(`🤖 Trying ${name} for section improvement...`);

          // Individual timeout for each model (25 seconds)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(`Section improvement API timeout for ${name}`)
                ),
              25000
            );
          });

          const fetchPromise = fetch(
            "https://router.huggingface.co/v1/chat/completions",
            {
              headers: {
                Authorization: `Bearer ${this.huggingfaceApiKey}`,
                "Content-Type": "application/json",
              },
              method: "POST",
              body: JSON.stringify({
                messages: messages,
                model: model,
                stream: false,
                max_tokens: 500,
                temperature: 0.7,
                top_p: 0.9,
              }),
            }
          );

          const response = await Promise.race([fetchPromise, timeoutPromise]);

          const result = await response.json();

          if (result.choices && result.choices[0]) {
            return {
              originalSection: sectionContent,
              improvedSection: result.choices[0].message.content.trim(),
              sectionName: sectionName,
              improvementType: improvementType,
            };
          } else {
            throw new Error(`Invalid response from ${name}`);
          }
        } catch (error) {
          console.error(
            `❌ ${name} failed for section improvement:`,
            error.message
          );

          // If this is the last model, throw the error
          if (i === models.length - 1) {
            throw error;
          }

          // Otherwise, continue to next model
          console.log(`⚠️ Trying next model for section improvement...`);
        }
      }
    } catch (error) {
      console.error("Error improving section:", error);
      throw error;
    }
  }
}

module.exports = new ChatService();
