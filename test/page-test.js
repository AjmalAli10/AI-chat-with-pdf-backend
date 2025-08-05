const pdfService = require("../services/pdfService");
const embeddingService = require("../services/embeddingService");
const vectorDBService = require("../services/vectorDBService");
const chatService = require("../services/chatService");
const fs = require("fs-extra");
const path = require("path");

async function testPageWiseFunctionality() {
  try {
    console.log("🧪 Testing page-wise functionality...");

    // Force recreate collection with pageNumber index
    console.log("🔄 Recreating collection with pageNumber index...");
    const vectorDBService = require("../services/vectorDBService");
    try {
      await vectorDBService.client.deleteCollection(
        vectorDBService.collectionName
      );
      console.log("🗑️ Deleted existing collection");
    } catch (error) {
      console.log("ℹ️ No existing collection to delete");
    }
    await vectorDBService.initializeCollection();
    console.log("✅ Collection recreated with pageNumber index");

    // Create a simple test PDF file using a text file that we'll treat as PDF content
    const testContent = `Page 1: Introduction
This is the first page of our test document.
It contains basic information about the project.

Page 2: Methodology
This page discusses the research methodology.
It includes data collection methods and analysis techniques.

Page 3: Results
The results page shows the findings.
It contains charts, graphs, and statistical data.

Page 4: Discussion
This page discusses the implications of the results.
It connects findings to existing literature.

Page 5: Conclusion
The final page summarizes the main points.
It provides recommendations for future research.`;

    // Create a mock file object that simulates a PDF
    const mockFile = {
      originalname: "test-document.pdf",
      buffer: Buffer.from(testContent),
      size: testContent.length,
    };

    console.log("📄 Processing test PDF...");

    // For testing purposes, let's create a structured data object directly
    // instead of trying to parse a non-PDF buffer
    const testStructuredData = {
      documentType: "research_paper",
      pages: [
        {
          pageNumber: 1,
          text: "Page 1: Introduction\nThis is the first page of our test document.\nIt contains basic information about the project.",
          wordCount: 15,
        },
        {
          pageNumber: 2,
          text: "Page 2: Methodology\nThis page discusses the research methodology.\nIt includes data collection methods and analysis techniques.",
          wordCount: 18,
        },
        {
          pageNumber: 3,
          text: "Page 3: Results\nThe results page shows the findings.\nIt contains charts, graphs, and statistical data.",
          wordCount: 16,
        },
        {
          pageNumber: 4,
          text: "Page 4: Discussion\nThis page discusses the implications of the results.\nIt connects findings to existing literature.",
          wordCount: 17,
        },
        {
          pageNumber: 5,
          text: "Page 5: Conclusion\nThe final page summarizes the main points.\nIt provides recommendations for future research.",
          wordCount: 16,
        },
      ],
      sections: [
        {
          title: "Introduction",
          content: [
            "This is the first page of our test document.",
            "It contains basic information about the project.",
          ],
        },
        {
          title: "Methodology",
          content: [
            "This page discusses the research methodology.",
            "It includes data collection methods and analysis techniques.",
          ],
        },
        {
          title: "Results",
          content: [
            "The results page shows the findings.",
            "It contains charts, graphs, and statistical data.",
          ],
        },
        {
          title: "Discussion",
          content: [
            "This page discusses the implications of the results.",
            "It connects findings to existing literature.",
          ],
        },
        {
          title: "Conclusion",
          content: [
            "The final page summarizes the main points.",
            "It provides recommendations for future research.",
          ],
        },
      ],
      metadata: {
        totalPages: 5,
        wordCount: 82,
        extractedAt: new Date().toISOString(),
      },
      confidence: 0.8,
    };

    const fileId = "test-file-123";

    console.log(
      `✅ Created test structured data with ${testStructuredData.pages.length} pages`
    );

    // Create embeddings
    console.log("🔗 Creating embeddings...");
    const embeddings = await embeddingService.chunkAndEmbed(
      testStructuredData,
      fileId
    );
    console.log(`✅ Created ${embeddings.length} embeddings`);

    // Store in vector database
    console.log("💾 Storing in vector database...");
    await vectorDBService.storeEmbeddings(embeddings);
    console.log("✅ Stored in vector database");

    // Test page-specific queries
    console.log("\n🔍 Testing page-specific queries...");

    const testQueries = [
      "What is on page 1?",
      "Tell me about page 3",
      "What does page 5 contain?",
      "Summarize page 2",
    ];

    for (const query of testQueries) {
      console.log(`\n📝 Query: "${query}"`);
      try {
        const response = await chatService.chatWithPDF(query, fileId);
        console.log(`✅ Response: ${response.response.substring(0, 200)}...`);
        console.log(`📊 Context: ${response.context.chunksUsed} chunks used`);
        if (response.context.isPageSpecific) {
          console.log(
            `📄 Page-specific query detected for page ${response.context.targetPage}`
          );
        }
      } catch (error) {
        console.error(`❌ Error with query "${query}":`, error.message);
      }
    }

    console.log("\n✅ Page-wise functionality test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPageWiseFunctionality();
}

module.exports = { testPageWiseFunctionality };
