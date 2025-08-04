const dotenv = require("dotenv");
const axios = require("axios");
dotenv.config();

async function testLayoutLMv3TextProcessing() {
  try {
    console.log("🧪 Testing LayoutLMv3 Text Processing...");

    const apiKey = process.env.HUGGINGFACE_API_KEY;

    console.log("🔑 API Key:", apiKey ? "Set" : "Not set");

    if (!apiKey) {
      console.error(
        "❌ No Hugging Face API key found in environment variables"
      );
      return;
    }

    // Test with known working models first
    const testModels = [
      "gpt2",
      "microsoft/DialoGPT-medium",
      "bert-base-uncased",
      "sentence-transformers/all-MiniLM-L6-v2",
    ];

    const testText = `
RESUME
John Doe
Software Engineer

EXPERIENCE
Senior Developer at Tech Corp (2020-2023)
- Led development of web applications
- Managed team of 5 developers

EDUCATION
Bachelor of Computer Science
University of Technology (2016-2020)

SKILLS
JavaScript, Python, React, Node.js
    `;

    console.log("📄 Test Text:", testText);

    for (const model of testModels) {
      console.log(`\n🤖 Testing model: ${model}`);

      try {
        // Test the model API
        const response = await axios.post(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            inputs: testText,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: 30000, // 30 second timeout
          }
        );

        console.log("✅ Model works:", model);
        console.log("📡 Response status:", response.status);
        console.log("📊 Response type:", typeof response.data);

        if (Array.isArray(response.data)) {
          console.log("📝 Array response length:", response.data.length);
          console.log("📝 Sample response:", response.data[0]);
        } else if (typeof response.data === "object") {
          console.log("📊 Response keys:", Object.keys(response.data));
          console.log("📝 Sample response:", response.data);
        } else {
          console.log("📝 Response:", response.data);
        }

        // If we found a working model, test our processing
        console.log("\n🔧 Testing our processing function...");
        const processedData = processTextResponse(response.data, {
          rawText: testText,
          totalPages: 1,
          pages: [{ text: testText, pageNumber: 1 }],
        });

        console.log("✅ Processed data structure:", Object.keys(processedData));
        console.log("📄 Document type:", processedData.documentType);
        console.log("📋 Sections found:", processedData.sections.length);
        console.log("📊 Confidence:", processedData.confidence);

        // If we found a working model, break
        break;
      } catch (error) {
        console.log(`❌ Model ${model} failed:`, error.message);
        if (error.response) {
          console.log("📡 Status:", error.response.status);
          console.log("📄 Response:", error.response.data);
        }
      }
    }

    // Test LayoutLM models with different approach
    console.log("\n🔄 Testing LayoutLM models with different approach...");
    const layoutModels = [
      "microsoft/layoutlmv3-base",
      "microsoft/layoutlm-base-uncased",
    ];

    for (const model of layoutModels) {
      console.log(`\n🤖 Testing LayoutLM model: ${model}`);

      try {
        // Try with different input format
        const response = await axios.post(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            inputs: {
              text: testText,
              boxes: [[0, 0, 100, 100]], // Simple bounding box
            },
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        );

        console.log("✅ LayoutLM model works:", model);
        console.log("📡 Response:", response.data);
      } catch (error) {
        console.log(`❌ LayoutLM model ${model} failed:`, error.message);
        if (error.response) {
          console.log("📡 Status:", error.response.status);
          console.log("📄 Response:", error.response.data);
        }
      }
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.response) {
      console.error("❌ Response status:", error.response.status);
      console.error("❌ Response data:", error.response.data);
    }
  }
}

/**
 * Process text response from any model
 */
function processTextResponse(apiResponse, pdfData) {
  try {
    // Handle different response formats
    let words = [];
    let bboxes = [];
    let labels = [];

    if (Array.isArray(apiResponse)) {
      // Handle array response (like from GPT models)
      words = apiResponse
        .map((item) => item.generated_text || item.text || item)
        .filter(Boolean);
      bboxes = words.map(() => [0, 0, 0, 0]); // Default bboxes
      labels = words.map(() => "text"); // Default labels
    } else if (typeof apiResponse === "object") {
      // Handle object response
      words = apiResponse.words || apiResponse.text || [];
      bboxes = apiResponse.bboxes || words.map(() => [0, 0, 0, 0]);
      labels = apiResponse.labels || words.map(() => "text");
    } else {
      // Handle string response
      words = [apiResponse].filter(Boolean);
      bboxes = words.map(() => [0, 0, 0, 0]);
      labels = words.map(() => "text");
    }

    // Group words into meaningful sections
    const sections = groupWordsIntoSections(words, bboxes, labels);

    return {
      documentType: classifyDocumentType(pdfData.rawText),
      sections: sections,
      pages: pdfData.pages,
      layout: {
        words: words.map((word, index) => ({
          text: word,
          bbox: bboxes[index] || [0, 0, 0, 0],
          label: labels[index] || "text",
        })),
        sections: sections,
      },
      metadata: {
        totalPages: pdfData.totalPages,
        wordCount: words.length,
        extractedAt: new Date().toISOString(),
        modelUsed: "text-model",
      },
      confidence: 0.7, // Default confidence
    };
  } catch (error) {
    console.error("Error processing text response:", error);
    return {
      documentType: "unknown",
      sections: [],
      confidence: 0.0,
    };
  }
}

/**
 * Group words into sections based on layout and labels
 */
function groupWordsIntoSections(words, bboxes, labels) {
  const sections = [];
  let currentSection = { title: "Content", content: [] };

  words.forEach((word, index) => {
    const label = labels[index] || "text";
    const bbox = bboxes[index] || [0, 0, 0, 0];

    // Check if this word indicates a new section
    if (label === "header" || isSectionHeader(word)) {
      if (currentSection.content.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: word, content: [] };
    } else {
      currentSection.content.push(word);
    }
  });

  if (currentSection.content.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Check if word is a section header
 */
function isSectionHeader(word) {
  const trimmed = word.trim();
  return (
    trimmed.length < 50 &&
    (trimmed.toUpperCase() === trimmed ||
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed))
  );
}

/**
 * Classify document type
 */
function classifyDocumentType(text) {
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

// Run the test
testLayoutLMv3TextProcessing();
