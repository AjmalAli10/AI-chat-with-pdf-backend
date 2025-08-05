# Chat with PDF

An intelligent PDF chat system that allows users to upload PDF documents and have conversations with them using AI. The system uses Hugging Face models for natural language processing and Qdrant for vector storage.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Setup](#setup)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Development](#development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Features

- **PDF Processing**: Upload and parse PDF documents page by page
- **Vector Embeddings**: Convert text to embeddings using Hugging Face models
- **Vector Database**: Store and search embeddings using Qdrant
- **Chat API**: Intelligent responses based on document content
- **File Management**: Secure file upload and storage
- **Page-wise Queries**: Ask questions about specific pages (e.g., "What's on page 5?")

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Docker** (for Qdrant vector database)
- **Git**

You'll also need:

- **Hugging Face API key** (for AI models)

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd AI-chat-with-pdf-backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Configuration

1. Copy the environment template:

```bash
cp env.example .env
```

2. Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Hugging Face API Configuration
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Model Configuration
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
NER_MODEL=dslim/bert-base-NER

# Chat Model Configuration (with fallback support)
PRIMARY_MODEL=Qwen/Qwen2-7B-Instruct
FALLBACK_MODEL_1=zai-org/GLM-4.5
FALLBACK_MODEL_2=microsoft/DialoGPT-medium

# Qdrant Vector Database Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Vercel Blob Storage Configuration (for production deployment)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
```

## Setup

### Step 1: Start Vector Database

The application uses Qdrant for vector storage. Start it with Docker:

```bash
npm run docker:up
```

This will start Qdrant on `http://localhost:6333`.

### Step 2: Verify Installation

1. **Test the API health**:

```bash
curl http://localhost:3000/health
```

2. **Run the test suite**:

```bash
npm test
```

3. **Test page-wise functionality**:

```bash
node test/page-test.js
```

### Step 3: Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`.

## Usage

### Quick Start

1. **Upload a PDF**:

```bash
curl -X POST -F "pdf=@your-document.pdf" http://localhost:3000/upload
```

2. **Chat with the document**:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"message": "What is this document about?", "filename": "your-document.pdf"}' \
  http://localhost:3000/chat
```

### Page-wise Queries

The system supports page-specific queries. You can ask questions about specific pages:

#### Examples

- **"What's on page 5?"** - Get content and analysis from page 5
- **"Tell me about page 3"** - Summarize page 3
- **"What does page 1 contain?"** - Describe page 1 content
- **"Summarize page 2"** - Provide a summary of page 2

#### Query Detection

The system automatically detects page-specific queries using patterns like:

- "page X" (e.g., "page 5")
- "the Xth page" (e.g., "the 5th page")
- "page number X" (e.g., "page number 3")

### API Endpoints

#### PDF Upload

- `POST /upload` - Upload a PDF file
- `GET /uploads/:filename` - Serve uploaded PDF files

#### Chat

- `POST /chat` - Send a chat message and get AI response

#### Health Check

- `GET /health` - API health status

### Request Examples

#### Upload PDF

```bash
curl -X POST -F "pdf=@document.pdf" http://localhost:3000/upload
```

#### Chat with Document

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "message": "What is the main topic of this document?",
    "filename": "document.pdf"
  }' \
  http://localhost:3000/chat
```

#### Page-specific Query

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "message": "What is on page 3?",
    "filename": "document.pdf"
  }' \
  http://localhost:3000/chat
```

## API Reference

### POST /upload

Upload a PDF file for processing.

**Request:**

- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `pdf` file

**Response:**

```json
{
  "success": true,
  "filename": "document.pdf",
  "message": "PDF uploaded and processed successfully"
}
```

### POST /chat

Send a message to chat with the uploaded PDF.

**Request:**

```json
{
  "message": "Your question here",
  "filename": "document.pdf"
}
```

**Response:**

```json
{
  "response": "AI-generated response based on document content",
  "sources": ["relevant text chunks from document"]
}
```

### GET /health

Check API health status.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run test:simple` - Run simple tests
- `npm run test:page` - Test page-wise functionality
- `npm run docker:up` - Start Docker services (Qdrant)
- `npm run docker:down` - Stop Docker services

### Development Workflow

1. **Start Qdrant**:

```bash
npm run docker:up
```

2. **Start development server**:

```bash
npm run dev
```

3. **Make API requests** to test functionality:

```bash
# Upload a PDF
curl -X POST -F "pdf=@your-document.pdf" http://localhost:3000/upload

# Chat with the document
curl -X POST -H "Content-Type: application/json" \
  -d '{"message": "What is this document about?", "filename": "your-document.pdf"}' \
  http://localhost:3000/chat
```

### Project Structure

```
AI-chat-with-pdf-backend/
├── api/                    # API server for Vercel deployment
│   └── server.js
├── routes/                 # Express routes
│   ├── chatRoutes.js
│   └── pdfRoutes.js
├── services/              # Backend services
│   ├── chatService.js
│   ├── embeddingService.js
│   ├── pdfService.js
│   └── vectorDBService.js
├── test/                  # Test files
│   ├── test.js
│   ├── simple-test.js
│   └── page-test.js
├── uploads/              # Uploaded PDF files
├── server.js             # Express server
├── docker-compose.yml    # Docker configuration for Qdrant
├── package.json
└── README.md
```

## Deployment

### Vercel Deployment

For deploying to Vercel, see the comprehensive guide in [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

Key points for Vercel deployment:

- Set all environment variables in Vercel dashboard
- Configure model fallbacks for reliability
- Monitor function execution times
- Use preview deployments for testing
- **BLOB_READ_WRITE_TOKEN**: Required for Vercel Blob storage (get from Vercel dashboard)

### Docker Deployment

For local Docker deployment:

1. **Start Qdrant with Docker**:

```bash
npm run docker:up
```

2. **Stop Docker services**:

```bash
npm run docker:down
```

## Troubleshooting

### Common Issues

1. **PDF upload fails**: Check file size and format
2. **Chat not working**: Verify Hugging Face API key
3. **Vector search issues**: Ensure Qdrant is running
4. **Docker issues**: Make sure Docker is installed and running
5. **Page-specific queries not working**: Ensure PDF has proper page structure

### Performance Tips

1. **Large PDFs**: Consider splitting very large documents
2. **Memory usage**: Monitor PDF processing memory consumption
3. **Network**: Optimize for slower connections with progress indicators
4. **Page queries**: For very long pages, consider breaking them into smaller chunks

### Testing Page-wise Functionality

Run the page-wise test to verify functionality:

```bash
node test/page-test.js
```

This will test:

- Page-wise PDF parsing
- Page-specific chunking
- Page-aware vector storage
- Page-specific query detection and response

### Model Configuration

The application supports configurable AI models with automatic fallback:

- **PRIMARY_MODEL**: Main model for chat responses (default: Qwen/Qwen2-7B-Instruct)
- **FALLBACK_MODEL_1**: First fallback if primary fails (default: zai-org/GLM-4.5)
- **FALLBACK_MODEL_2**: Second fallback if first fails (default: microsoft/DialoGPT-medium)
- **NER_MODEL**: Named Entity Recognition model for information extraction (default: dslim/bert-base-NER)

This ensures reliability even if some models are unavailable or slow.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
