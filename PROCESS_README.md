# PDF Processing and Chat Pipeline - Complete Process Guide

This document explains the complete process flow from PDF upload to vectorization and intelligent chat functionality.

## 🚀 Complete Process Overview

```
PDF Upload → Parsing → NER Processing → Chunking → Embedding → Vector Storage → Chat Interface
```

## 📋 Step-by-Step Process Breakdown

### **Step 1: PDF Upload and Storage** 📄

**Location**: `services/pdfService.js` - `uploadPDF()` method

**Process**:

1. **File Validation**: Checks if uploaded file is PDF format
2. **Unique ID Generation**: Creates UUID for file identification
3. **Cloud Storage**: Uploads to Vercel Blob for persistent storage
4. **Metadata Creation**: Stores file info (name, size, URL)

**Code Flow**:

```javascript
// File validation in routes/pdfRoutes.js
fileFilter: (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

// Upload to Vercel Blob
const blob = await put(fileName, file.buffer, {
  access: "public",
  addRandomSuffix: false,
  token: process.env.BLOB_READ_WRITE_TOKEN,
});
```

### **Step 2: PDF Parsing - Page-wise Text Extraction** 📖

**Location**: `services/pdfService.js` - `parsePDF()` method

**Process**:

1. **Full Document Parsing**: Extracts all pages using `pdf-parse`
2. **Page-wise Structure**: Creates separate objects for each page
3. **Layout Information**: Captures page dimensions and word counts
4. **Fallback Handling**: If page info unavailable, estimates page boundaries

**Code Flow**:

```javascript
const data = await pdfParse(fileBuffer, {
  max: 0, // Parse all pages
  version: "v2.0.550",
});

// Extract text page by page
data.pages.forEach((page, index) => {
  pages.push({
    pageNumber: index + 1,
    text: page.text || "",
    layout: { words: [], lines: [], tables: [] },
    width: page.width || 612,
    height: page.height || 792,
    wordCount: (page.text || "").split(/\s+/).length,
  });
});
```

### **Step 3: Structured Data Extraction via NER Model** 🔍

**Location**: `services/pdfService.js` - `extractStructuredData()` method

**Process**:

1. **Named Entity Recognition**: Uses Hugging Face NER model (`dslim/bert-base-NER`)
2. **Entity Classification**: Identifies persons, organizations, dates, locations
3. **Section Detection**: Automatically identifies document sections
4. **Document Classification**: Categorizes as resume, invoice, research paper, etc.

**Code Flow**:

```javascript
// Extract entities from text using NER
const entities = await this.extractEntities(pdfData.rawText);

// Process entities to create structured data
const structuredData = this.processNERResponse(entities, pdfData);

// Document classification
classifyDocumentType(text) {
  if (text.includes("resume") || text.includes("cv")) return "resume";
  if (text.includes("invoice") || text.includes("bill")) return "invoice";
  if (text.includes("abstract") || text.includes("methodology")) return "research_paper";
  return "general";
}
```

### **Step 4: Post-processing and Enhancement** ✨

**Location**: `services/pdfService.js` - `postProcessStructuredData()` method

**Process**:

1. **Document-specific Enhancements**: Adds suggestions for resumes, explanations for research papers
2. **Summary Generation**: Creates document summaries
3. **Metadata Enrichment**: Adds confidence scores and processing timestamps

**Code Flow**:

```javascript
// Add improvement suggestions for resumes
if (processedData.documentType === "resume") {
  processedData.suggestions = this.generateResumeSuggestions(processedData);
}

// Add explanations for research papers
if (processedData.documentType === "research_paper") {
  processedData.explanations = this.generateResearchExplanations(processedData);
}

// Summarize long content
processedData.summary = this.generateSummary(processedData);
```

### **Step 5: Chunking and Embedding Generation** 🧩

**Location**: `services/embeddingService.js` - `chunkAndEmbed()` method

**Process**:

1. **Smart Chunking**: Splits content into manageable pieces (max 512 words with 50-word overlap)
2. **Page-wise Chunking**: Preserves page structure for page-specific queries
3. **Section Preservation**: Maintains section boundaries
4. **Embedding Generation**: Uses Hugging Face model (`sentence-transformers/all-MiniLM-L6-v2`)
5. **Batch Processing**: Processes chunks in batches to optimize API calls

**Code Flow**:

```javascript
// Create chunks from structured data
const chunks = this.createChunks(structuredData);

// Generate embeddings for chunks
const embeddings = await this.generateEmbeddings(chunks, signal);

// Process chunks in batches
for (let i = 0; i < chunks.length; i += batchSize) {
  const batch = chunks.slice(i, i + batchSize);
  const batchEmbeddings = await this.getBatchEmbeddings(batchTexts);
}
```

### **Step 6: Vector Database Storage** 🗄️

**Location**: `services/vectorDBService.js` - `storeEmbeddings()` method

**Process**:

1. **Qdrant Vector Database**: Stores embeddings with metadata
2. **Rich Metadata**: Includes file ID, document type, section info, page numbers
3. **Indexing**: Creates efficient indexes for fast retrieval
4. **Page-aware Storage**: Enables page-specific queries

**Code Flow**:

```javascript
const points = embeddings.map((embedding) => ({
  id: embedding.id,
  vector: embedding.embedding,
  payload: {
    content: embedding.content,
    fileId: embedding.metadata.fileId,
    documentType: embedding.metadata.documentType,
    section: embedding.metadata.section,
    pageNumber: embedding.metadata.pageNumber,
    chunkType: embedding.metadata.chunkType,
    uploadedAt: new Date().toISOString(),
  },
}));

await this.client.upsert(this.collectionName, { points: points });
```

### **Step 7: Chat Interface and Query Processing** 💬

**Location**: `services/chatService.js` - `chatWithPDF()` method

**Process**:

1. **Page-specific Query Detection**: Detects queries like "What's on page 5?" using regex patterns
2. **Query Processing**: Converts user questions to embeddings
3. **Semantic Search**: Finds most relevant document chunks
4. **Context Building**: Combines relevant information with page-specific context
5. **AI Response Generation**: Uses multiple models with fallback (Qwen, GLM-4.5, DialoGPT)
6. **Page-specific Handling**: Special routing for page queries using `searchByFileIdAndPage()`

**Code Flow**:

```javascript
// Detect page-specific queries
const pageQueryResult = this.detectPageSpecificQuery(query);
if (pageQueryResult.isPageSpecific && fileId) {
  // Get chunks for specific page
  relevantChunks = await vectorDBService.searchByFileIdAndPage(
    fileId,
    targetPage,
    10
  );
} else if (fileId) {
  // Chat with specific PDF
  relevantChunks = await vectorDBService.searchByFileId(fileId, 10);
} else {
  // Chat with all PDFs using semantic search
  const queryEmbedding = await embeddingService.getQueryEmbedding(query);
  relevantChunks = await vectorDBService.searchSimilar(queryEmbedding, 5);
}

// Build context with page-specific information
const context = this.buildContext(
  relevantChunks,
  fileId,
  isPageSpecific,
  targetPage
);

// Generate response using AI models
const response = await this.generateResponse(query, context, chatHistory);
```

**Page-specific Query Detection**:

```javascript
detectPageSpecificQuery(query) {
  const pagePatterns = [
    /page\s+(\d+)/i,           // "page 5", "Page 3"
    /the\s+(\d+)(?:st|nd|rd|th)?\s+page/i,  // "the 5th page"
    /page\s+number\s+(\d+)/i,  // "page number 5"
    /(\d+)(?:st|nd|rd|th)?\s+page/i,        // "5th page"
  ];

  // Returns { isPageSpecific: true, pageNumber: 5 }
}
```

## 🔧 Technical Implementation Details

### **File Structure**:

```
services/
├── pdfService.js      # Steps 1-4: PDF processing and NER
├── embeddingService.js # Step 5: Chunking and embedding
├── vectorDBService.js  # Step 6: Vector database operations
└── chatService.js     # Step 7: Chat interface and AI responses

routes/
├── pdfRoutes.js       # PDF upload and management endpoints
└── chatRoutes.js      # Chat and query endpoints
```

### **Key Technologies Used**:

1. **PDF Processing**: `pdf-parse` library
2. **AI Models**: Hugging Face Inference API
   - NER Model: `dslim/bert-base-NER`
   - Embedding Model: `sentence-transformers/all-MiniLM-L6-v2`
   - Chat Models: `Qwen/Qwen2-7B-Instruct`, `zai-org/GLM-4.5`, `microsoft/DialoGPT-medium`
3. **Vector Database**: Qdrant
4. **Cloud Storage**: Vercel Blob
5. **Web Framework**: Express.js

### **Environment Variables Required**:

```env
HUGGINGFACE_API_KEY=your_huggingface_api_key
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
NER_MODEL=dslim/bert-base-NER
PRIMARY_MODEL=Qwen/Qwen2-7B-Instruct
FALLBACK_MODEL_1=zai-org/GLM-4.5
FALLBACK_MODEL_2=microsoft/DialoGPT-medium
QDRANT_URL=http://localhost:6333
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

## 🎯 Key Features

### **Page-wise Processing**:

- Each page is processed separately
- Enables page-specific queries like "What's on page 5?"
- Maintains page structure in vector database

### **Multi-model Fallback**:

- Primary model: Qwen/Qwen2-7B-Instruct
- Fallback 1: zai-org/GLM-4.5
- Fallback 2: microsoft/DialoGPT-medium
- Ensures reliability even if some models are unavailable

### **Rich Metadata Storage**:

- File ID, document type, section info
- Page numbers, chunk types, word counts
- Processing timestamps and model information

### **Semantic Search**:

- Converts queries to embeddings
- Finds most similar document chunks
- Returns contextually relevant responses

### **Document Classification**:

- Automatically categorizes documents as:
  - Resume/CV
  - Invoice/Bill
  - Research Paper
  - Contract
  - General Document

## 📊 Performance Optimizations

1. **Batch Processing**: Embeddings generated in batches of 5
2. **Timeout Handling**: 30-second timeouts for API calls
3. **Abort Controller**: Supports request cancellation
4. **Caching**: Vector database provides fast retrieval
5. **Indexing**: Efficient indexes for filtering and search

## 🔍 API Endpoints

### **PDF Management**:

- `POST /api/pdf/upload` - Upload and process PDF
- `GET /api/pdf/files` - List uploaded files
- `GET /api/pdf/file/:fileId` - Get specific file info
- `DELETE /api/pdf/file/:fileId` - Delete file and embeddings

### **Chat Interface**:

- `POST /api/chat/query` - Chat with documents
- `POST /api/chat/analyze` - Analyze specific document
- `POST /api/chat/improve` - Improve document sections
- `GET /api/chat/suggestions/:fileId` - Get follow-up questions
- `GET /api/chat/search` - Search across documents

## 🚀 Usage Examples

### **Upload PDF**:

```bash
curl -X POST -F "pdf=@document.pdf" http://localhost:3000/api/pdf/upload
```

### **Chat with Document**:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"query": "What is this document about?", "fileId": "your-file-id"}' \
  http://localhost:3000/api/chat/query
```

### **Page-specific Query**:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"query": "What is on page 3?", "fileId": "your-file-id"}' \
  http://localhost:3000/api/chat/query
```

**Supported Page Query Patterns**:

- "What's on page 5?"
- "Tell me about page 3"
- "What does page 1 contain?"
- "Summarize page 2"
- "The 5th page"
- "Page number 3"
- "3rd page"

## 🔧 Troubleshooting

### **Common Issues**:

1. **PDF upload fails**: Check file size and format
2. **Chat not working**: Verify Hugging Face API key
3. **Vector search issues**: Ensure Qdrant is running
4. **Model timeouts**: Check network connectivity and API limits

### **Performance Tips**:

1. **Large PDFs**: Consider splitting very large documents
2. **Memory usage**: Monitor PDF processing memory consumption
3. **Network**: Optimize for slower connections with progress indicators
4. **Page queries**: For very long pages, consider breaking them into smaller chunks

This process creates a complete, intelligent PDF chat system that can understand, process, and respond to questions about uploaded documents with high accuracy and reliability.
