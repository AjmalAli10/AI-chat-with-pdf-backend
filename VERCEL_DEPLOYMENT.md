# Vercel Deployment Guide

This guide will help you deploy your chat-with-pdf application to Vercel with proper environment variable configuration.

## 🚀 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Hugging Face API Key**: Get your API key from [huggingface.co](https://huggingface.co/settings/tokens)

## 📋 Environment Variables Setup

### Required Environment Variables

When deploying to Vercel, you'll need to configure these environment variables in your Vercel project settings:

#### 🔑 **API Keys**

```
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

#### 🎯 **Model Configuration**

```
PRIMARY_MODEL=Qwen/Qwen2-7B-Instruct
FALLBACK_MODEL_1=zai-org/GLM-4.5
FALLBACK_MODEL_2=microsoft/DialoGPT-medium
```

#### 📄 **Document Processing Models**

```
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
NER_MODEL=dslim/bert-base-NER
```

#### ⚙️ **Server Configuration**

```
PORT=3000
NODE_ENV=production
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

#### 🗄️ **Qdrant Vector Database Configuration**

```
# For cloud Qdrant (recommended for production)
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key

# For local Docker (development only)
# QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY=
```

## 🛠️ Deployment Steps

### 1. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Select the repository containing your chat-with-pdf code

### 2. Configure Environment Variables

1. In your Vercel project dashboard, go to **Settings** → **Environment Variables**
2. Add each environment variable listed above
3. Make sure to set the environment to **Production** (and optionally **Preview** for testing)

### 3. Deploy Configuration

#### Build Settings

- **Framework Preset**: Node.js
- **Build Command**: `npm install && npm run build` (if you have a build script)
- **Output Directory**: `./` (or your build output directory)
- **Install Command**: `npm install`

#### Runtime Settings

- **Node.js Version**: 18.x or higher

### 4. Deploy

1. Click **Deploy** in Vercel
2. Wait for the build to complete
3. Your app will be available at the provided Vercel URL

## 🔧 Custom Model Configuration

### Available Models for PRIMARY_MODEL:

- `Qwen/Qwen2-7B-Instruct` (default - good performance)
- `meta-llama/Llama-2-7b-chat-hf` (requires access)
- `microsoft/DialoGPT-large` (faster, smaller)
- `gpt2` (very fast, basic responses)

### Available Models for FALLBACK_MODEL_1:

- `zai-org/GLM-4.5` (default)
- `microsoft/DialoGPT-medium`
- `gpt2`

### Available Models for FALLBACK_MODEL_2:

- `microsoft/DialoGPT-medium` (default)
- `gpt2`
- `distilgpt2`

### Available Models for NER_MODEL:

- `dslim/bert-base-NER` (default - good for general NER)
- `dbmdz/bert-large-cased-finetuned-conll03-english` (high accuracy)
- `Jean-Baptiste/roberta-large-ner-english` (RoBERTa-based)
- `microsoft/DialoGPT-medium` (faster, smaller)

## 🗄️ Qdrant Vector Database Setup

### Local Development (Docker)

For local development, use Docker:

```bash
docker-compose up -d qdrant
```

### Production (Cloud Qdrant)

For production deployment on Vercel, use cloud Qdrant:

1. **Sign up for Qdrant Cloud**: [cloud.qdrant.io](https://cloud.qdrant.io)
2. **Create a cluster** and get your API key
3. **Set environment variables**:
   - `QDRANT_URL=https://your-cluster.qdrant.io`
   - `QDRANT_API_KEY=your_api_key`

### Qdrant Configuration Options

- **Local Docker**: `QDRANT_URL=http://localhost:6333` (no API key needed)
- **Cloud Qdrant**: `QDRANT_URL=https://your-cluster.qdrant.io` with `QDRANT_API_KEY`
- **Self-hosted**: `QDRANT_URL=http://your-server:6333` with optional API key

## 🧪 Testing Your Deployment

### 1. Test Basic Functionality

```bash
# Test the API endpoint
curl -X POST https://your-vercel-app.vercel.app/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Hello, how are you?"}'
```

### 2. Test File Upload

```bash
# Test PDF upload
curl -X POST https://your-vercel-app.vercel.app/api/pdf/upload \
  -F "file=@your-test-file.pdf"
```

### 3. Test Chat with PDF

```bash
# Test chat with uploaded PDF
curl -X POST https://your-vercel-app.vercel.app/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is this document about?", "fileId": "your-file-id"}'
```

## 🔍 Troubleshooting

### Common Issues:

1. **Environment Variables Not Set**

   - Ensure all required environment variables are set in Vercel
   - Check that the environment is set to "Production"

2. **API Key Issues**

   - Verify your Hugging Face API key is valid
   - Check API key permissions

3. **Model Loading Errors**

   - Try different models in the fallback configuration
   - Some models may not be available on all providers

4. **Timeout Issues**
   - The fallback mechanism should handle timeouts automatically
   - Check Vercel function timeout limits (10 seconds for hobby plan)

### Debugging:

1. **Check Vercel Logs**

   - Go to your project dashboard
   - Click on a deployment
   - Check the "Functions" tab for error logs

2. **Test Locally First**
   - Test with the same environment variables locally
   - Use `npm start` to run the server locally

## 📊 Monitoring

### Vercel Analytics

- Monitor function execution times
- Check for timeout errors
- Track API usage

### Custom Logging

The application includes detailed logging for:

- Model selection and fallback
- API request/response times
- Error handling

## 🔄 Updates

To update your deployment:

1. Push changes to your GitHub repository
2. Vercel will automatically redeploy
3. Update environment variables if needed in the Vercel dashboard

## 💡 Tips

1. **Start with Simple Models**: Use `gpt2` or `microsoft/DialoGPT-medium` for faster responses
2. **Monitor Costs**: Different models have different costs and response times
3. **Test Fallbacks**: Ensure your fallback models are working correctly
4. **Use Preview Deployments**: Test changes in preview before deploying to production

## 📞 Support

If you encounter issues:

1. Check the Vercel documentation
2. Review the application logs
3. Test with different model configurations
4. Consider using simpler models for faster responses
