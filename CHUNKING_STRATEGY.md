# Chunking Strategy - How We Break Down PDF Content

This document explains our comprehensive chunking strategy for processing PDF documents into searchable, embeddable pieces.

## 🎯 Overview

Our chunking strategy is designed to:

- **Preserve context** while breaking down large documents
- **Enable page-specific queries** by maintaining page structure
- **Support semantic search** across all document content
- **Optimize for AI models** with appropriate chunk sizes
- **Maintain document structure** through rich metadata

## 📏 Chunking Parameters

```javascript
// Configuration in EmbeddingService constructor
this.maxChunkSize = 512; // Maximum words per chunk
this.overlapSize = 50; // Overlap between chunks for context continuity
```

**Why these values?**

- **512 words**: Optimal for most AI models (not too long, not too short)
- **50-word overlap**: Ensures context continuity between chunks
- **Word-based splitting**: More natural than character-based splitting

## 🔄 Chunking Process Flow

### **Step 1: Document-Level Chunk**

```javascript
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
```

**Purpose**: Provides overall document context for general queries.

### **Step 2: Page-Wise Chunking** 📄

```javascript
// Process each page separately for page-wise queries
if (structuredData.pages && structuredData.pages.length > 0) {
  structuredData.pages.forEach((page, pageIndex) => {
    if (page.text && page.text.trim()) {
      const pageChunks = this.chunkPage(page, pageIndex);
      chunks.push(...pageChunks);
    }
  });
}
```

**Purpose**: Enables page-specific queries like "What's on page 5?"

### **Step 3: Section-Wise Chunking** 📑

```javascript
// Process each section
structuredData.sections.forEach((section, sectionIndex) => {
  const sectionChunks = this.chunkSection(section, sectionIndex);
  chunks.push(...sectionChunks);
});
```

**Purpose**: Maintains logical document structure for section-based queries.

## 🧩 Chunking Algorithms

### **Page Chunking Algorithm**

```javascript
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
    for (let i = 0; i < words.length; i += this.maxChunkSize - this.overlapSize) {
      const chunkWords = words.slice(i, i + this.maxChunkSize);
      const chunkContent = chunkWords.join(" ");

      chunks.push({
        content: `Page ${page.pageNumber} (Part ${Math.floor(i / (this.maxChunkSize - this.overlapSize)) + 1}): ${chunkContent}`,
        metadata: {
          section: "page_content",
          pageNumber: page.pageNumber,
          pageIndex: pageIndex,
          chunkType: "page",
          chunkPart: Math.floor(i / (this.maxChunkSize - this.overlapSize)) + 1,
          wordCount: chunkWords.length,
          startWordIndex: i,
        },
      });
    }
  }
  return chunks;
}
```

### **Section Chunking Algorithm**

```javascript
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
    for (let i = 0; i < words.length; i += this.maxChunkSize - this.overlapSize) {
      const chunkWords = words.slice(i, i + this.maxChunkSize);
      const chunkContent = chunkWords.join(" ");

      chunks.push({
        content: `${section.title} (Part ${Math.floor(i / (this.maxChunkSize - this.overlapSize)) + 1}): ${chunkContent}`,
        metadata: {
          section: "section_content",
          sectionTitle: section.title,
          sectionIndex,
          chunkType: "section",
          chunkPart: Math.floor(i / (this.maxChunkSize - this.overlapSize)) + 1,
          wordCount: chunkWords.length,
          startWordIndex: i,
        },
      });
    }
  }
  return chunks;
}
```

## 📊 Chunk Types and Metadata

### **1. Document Info Chunks**

```javascript
{
  content: "Document Type: resume. This document contains 3 main sections with approximately 150 words.",
  metadata: {
    section: "document_info",
    documentType: "resume",
    totalSections: 3,
    totalPages: 2,
  }
}
```

### **2. Page Content Chunks**

```javascript
{
  content: "Page 1: Introduction\nThis is the first page of our test document...",
  metadata: {
    section: "page_content",
    pageNumber: 1,
    pageIndex: 0,
    wordCount: 45,
    chunkType: "page",
  }
}
```

### **3. Section Content Chunks**

```javascript
{
  content: "Experience: Senior Software Engineer at Tech Corp (2020-2023)...",
  metadata: {
    section: "section_content",
    sectionTitle: "Experience",
    sectionIndex: 1,
    wordCount: 120,
    chunkType: "section",
  }
}
```

### **4. Multi-Part Chunks** (for long content)

```javascript
{
  content: "Page 3 (Part 2): ...continued content from previous chunk...",
  metadata: {
    section: "page_content",
    pageNumber: 3,
    pageIndex: 2,
    chunkType: "page",
    chunkPart: 2,
    wordCount: 512,
    startWordIndex: 462,
  }
}
```

## 🎯 Chunking Benefits

### **1. Page-Specific Queries** 📄

- Each page is chunked separately
- Enables queries like "What's on page 5?"
- Maintains page boundaries and numbering

### **2. Context Preservation** 🔗

- 50-word overlap between chunks
- Prevents context loss at chunk boundaries
- Maintains semantic continuity

### **3. Flexible Search** 🔍

- Document-level chunks for general queries
- Page-level chunks for specific page queries
- Section-level chunks for topic-based queries

### **4. AI Model Optimization** 🤖

- 512-word chunks are optimal for most AI models
- Not too long (avoids token limits)
- Not too short (maintains context)

### **5. Rich Metadata** 📋

- Page numbers, section titles, chunk types
- Word counts, start positions
- Document type and structure information

## 📈 Chunking Examples

### **Example 1: Short Page (Single Chunk)**

```
Input: "Page 1: Introduction\nThis is a short page with basic information."

Output: One chunk with 15 words
```

### **Example 2: Long Page (Multiple Chunks)**

```
Input: "Page 2: Detailed Methodology\n[600 words of content...]"

Output:
- Chunk 1: "Page 2 (Part 1): [first 512 words]"
- Chunk 2: "Page 2 (Part 2): [next 462 words with 50-word overlap]"
```

### **Example 3: Section with Title**

```
Input: "Experience: Senior Engineer at Tech Corp (2020-2023)..."

Output: "Experience: Senior Engineer at Tech Corp (2020-2023)..."
```

## 🔧 Chunking Configuration

### **Environment Variables**

```env
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

### **Chunking Parameters**

```javascript
maxChunkSize = 512; // Maximum words per chunk
overlapSize = 50; // Overlap between chunks
```

### **Customization Options**

- Adjust `maxChunkSize` for different AI models
- Modify `overlapSize` for context preservation
- Add custom chunking rules for specific document types

## 🚀 Performance Considerations

### **Memory Usage**

- Chunks are processed in batches of 5
- Embeddings generated efficiently
- Metadata stored compactly

### **Search Performance**

- Rich metadata enables fast filtering
- Page-specific queries use direct indexing
- Semantic search across all chunks

### **Storage Optimization**

- Chunks stored with minimal redundancy
- Metadata enables efficient retrieval
- Vector database optimized for similarity search

## 📋 Chunking Summary

Our chunking strategy provides:

1. **Multi-level chunking**: Document, page, and section levels
2. **Context preservation**: Overlapping chunks maintain continuity
3. **Page-specific support**: Enables targeted page queries
4. **AI optimization**: Appropriate chunk sizes for models
5. **Rich metadata**: Comprehensive information for search and retrieval
6. **Flexible search**: Multiple query types supported

This approach ensures that users can ask both general questions about documents and specific questions about particular pages or sections, while maintaining optimal performance for AI model processing.
