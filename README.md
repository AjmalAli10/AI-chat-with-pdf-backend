# Chat with PDF

An intelligent PDF chat system that allows users to upload PDF documents and have conversations with them using AI. The system uses Hugging Face models for natural language processing and Qdrant for vector storage.

## Features

### Backend

- **PDF Processing**: Upload and parse PDF documents **page by page**
- **Vector Embeddings**: Convert text to embeddings using Hugging Face models
- **Vector Database**: Store and search embeddings using Qdrant
- **Chat API**: Intelligent responses based on document content
- **File Management**: Secure file upload and storage
- **Page-wise Queries**: Ask questions about specific pages (e.g., "What's on page 5?")

### Frontend (React)

- **Modern UI**: Clean, responsive design with Tailwind CSS
- **PDF Upload**: Drag and drop or click to upload PDF files
- **PDF Viewer**: Interactive PDF viewer with zoom and navigation
- **Chat Interface**: Real-time chat with the uploaded document
- **Performance Optimized**: Efficient PDF handling with optimized worker
- **Error Handling**: Comprehensive error boundaries and validation

## Tech Stack

### Backend

- **Node.js**: Server runtime
- **Express.js**: Web framework
- **Hugging Face**: AI models for embeddings and chat
- **Qdrant**: Vector database
- **Multer**: File upload handling
- **PDF-parse**: PDF text extraction with page-wise parsing

### Frontend

- **React 19**: Latest React with hooks
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **React PDF**: PDF viewing capabilities
- **Lucide React**: Beautiful icons
- **PDF.js**: Optimized PDF processing

## Project Structure

```
chat-with-pdf/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── PDFUpload.jsx
│   │   │   ├── PDFViewer.jsx
│   │   │   ├── ChatInterface.jsx
│   │   │   ├── MainLayout.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   └── LoadingSpinner.jsx
│   │   ├── hooks/          # Custom React hooks
│   │   │   └── useAppState.js
│   │   ├── services/       # API services
│   │   │   └── apiService.js
│   │   ├── utils/          # Utility functions
│   │   │   └── pdfUtils.js
│   │   └── App.jsx         # Main application
│   ├── public/             # Static assets
│   │   └── pdf.worker.min.js
│   └── package.json
├── routes/                  # Express routes
│   ├── chatRoutes.js
│   └── pdfRoutes.js
├── services/               # Backend services
│   ├── chatService.js
│   ├── embeddingService.js
│   ├── pdfService.js
│   └── vectorDBService.js
├── uploads/               # Uploaded PDF files
├── server.js             # Express server
└── package.json
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Environment variables (see `.env.example`)
- Hugging Face API key (for AI models)

### Installation

1. **Clone the repository**:

```bash
git clone <repository-url>
cd chat-with-pdf
```

2. **Install backend dependencies**:

```bash
npm install
```

3. **Install frontend dependencies**:

```bash
cd frontend
npm install
cd ..
```

4. **Set up environment variables**:

```bash
cp env.example .env
# Edit .env with your configuration
```

5. **Start the development servers**:

   **Option 1: Run both together**

   ```bash
   npm run dev:full
   ```

   **Option 2: Run separately**

   ```bash
   # Terminal 1 - Backend
   npm run dev

   # Terminal 2 - Frontend
   npm run frontend:dev
   ```

6. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

### Production Build

1. **Build the frontend**:

```bash
npm run frontend:build
```

2. **Start the production server**:

```bash
npm start
```

## API Endpoints

### PDF Upload

- `POST /upload` - Upload a PDF file
- `GET /uploads/:filename` - Serve uploaded PDF files

### Chat

- `POST /chat` - Send a chat message and get AI response

## Page-wise Querying

The system now supports page-specific queries. You can ask questions about specific pages in your PDF:

### Examples

- **"What's on page 5?"** - Get content and analysis from page 5
- **"Tell me about page 3"** - Summarize page 3
- **"What does page 1 contain?"** - Describe page 1 content
- **"Summarize page 2"** - Provide a summary of page 2

### How it Works

1. **Page-wise Parsing**: PDFs are parsed page by page, preserving page structure
2. **Page-specific Chunking**: Each page is chunked separately with page metadata
3. **Page-aware Search**: The system detects page-specific queries and searches only relevant pages
4. **Contextual Responses**: Responses focus on the specified page content

### Query Detection

The system automatically detects page-specific queries using patterns like:

- "page X" (e.g., "page 5")
- "the Xth page" (e.g., "the 5th page")
- "page number X" (e.g., "page number 3")

## Environment Variables

Create a `.env` file based on `env.example`:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Hugging Face API Configuration
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Model Configuration (all using Router API)
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
NER_MODEL=dslim/bert-base-NER

# Chat Model Configuration (with fallback support)
PRIMARY_MODEL=Qwen/Qwen2-7B-Instruct
FALLBACK_MODEL_1=zai-org/GLM-4.5
FALLBACK_MODEL_2=microsoft/DialoGPT-medium

# Qdrant Vector Database Configuration
# For local Docker: QDRANT_URL=http://localhost:6333 (no API key needed)
# For cloud Qdrant: QDRANT_URL=https://your-cluster.qdrant.io and QDRANT_API_KEY=your_api_key
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

### Model Configuration

The application supports configurable AI models with automatic fallback:

- **PRIMARY_MODEL**: Main model for chat responses (default: Qwen/Qwen2-7B-Instruct)
- **FALLBACK_MODEL_1**: First fallback if primary fails (default: zai-org/GLM-4.5)
- **FALLBACK_MODEL_2**: Second fallback if first fails (default: microsoft/DialoGPT-medium)
- **NER_MODEL**: Named Entity Recognition model for information extraction (default: dslim/bert-base-NER)

This ensures reliability even if some models are unavailable or slow.

### Vector Database Configuration

The application supports both local and cloud Qdrant setups:

- **Local Docker**: `QDRANT_URL=http://localhost:6333` (no API key needed)
- **Cloud Qdrant**: `QDRANT_URL=https://your-cluster.qdrant.io` with `QDRANT_API_KEY`
- **Self-hosted**: `QDRANT_URL=http://your-server:6333` with optional API key

## Deployment

### Vercel Deployment

For deploying to Vercel, see the comprehensive guide in [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

Key points for Vercel deployment:

- Set all environment variables in Vercel dashboard
- Configure model fallbacks for reliability
- Monitor function execution times
- Use preview deployments for testing

### Docker Deployment

For local Docker deployment:

## Docker Setup

1. **Start Qdrant with Docker**:

```bash
npm run docker:up
```

2. **Stop Docker services**:

```bash
npm run docker:down
```

## Development

### Available Scripts

**Backend**:

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run test:simple` - Run simple tests
- `npm run test:page` - Test page-wise functionality

**Frontend**:

- `npm run frontend:dev` - Start frontend development server
- `npm run frontend:build` - Build frontend for production
- `npm run dev:full` - Run both frontend and backend together

**Docker**:

- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services

## Performance Optimizations

### Frontend

- **PDF Worker**: Local, optimized PDF.js worker
- **Lazy Loading**: PDF pages loaded on demand
- **Memory Management**: Efficient PDF rendering with cleanup
- **Bundle Optimization**: Tree-shaking and code splitting
- **File Validation**: Client-side PDF validation

### Backend

- **Vector Search**: Efficient similarity search
- **File Processing**: Stream-based PDF parsing
- **Page-wise Chunking**: Optimized page-specific processing
- **Caching**: Embedding caching for repeated queries
- **Error Handling**: Comprehensive error management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Troubleshooting

### Common Issues

1. **PDF upload fails**: Check file size and format
2. **Chat not working**: Verify Hugging Face API key
3. **Vector search issues**: Ensure Qdrant is running
4. **Frontend build errors**: Check Node.js version and dependencies
5. **Page-specific queries not working**: Ensure PDF has proper page structure

### Performance Tips

1. **Large PDFs**: Consider splitting very large documents
2. **Memory usage**: Monitor PDF worker memory consumption
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
