const dotenv = require("dotenv");
const pdfService = require("../services/pdfService");
dotenv.config();

async function testPDFProcessing() {
  try {
    console.log("🧪 Testing PDF Processing with NER and Fallback...");

    // pdfService is already instantiated as a singleton

    // Test text - a resume document
    const testText = `
RESUME
John Doe
Software Engineer at Tech Corp

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

    // Create mock PDF data
    const pdfData = {
      rawText: testText,
      totalPages: 1,
      pages: [
        {
          pageNumber: 1,
          text: testText,
          width: 612,
          height: 792,
          wordCount: testText.split(/\s+/).length,
        },
      ],
    };

    console.log("📄 Test PDF Data:", {
      totalPages: pdfData.totalPages,
      wordCount: pdfData.rawText.split(/\s+/).length,
      documentType: pdfService.classifyDocumentType(pdfData.rawText),
    });

    // Test 1: NER Processing (if API key is available)
    console.log("\n🔍 Test 1: NER Processing...");
    try {
      const nerResult = await pdfService.extractStructuredData(pdfData);

      console.log("✅ NER Processing successful!");
      console.log("📄 Document Type:", nerResult.documentType);
      console.log("📋 Sections found:", nerResult.sections.length);
      console.log("🎯 Confidence:", nerResult.confidence);
      console.log("🏷️ Entities found:", Object.keys(nerResult.entities || {}));

      if (nerResult.entities) {
        Object.keys(nerResult.entities).forEach((type) => {
          console.log(`  ${type}: ${nerResult.entities[type].length} entities`);
        });
      }
    } catch (error) {
      console.log("⚠️ NER Processing failed:", error.message);
      console.log("🔄 Falling back to basic processing...");
    }

    // Test 2: Fallback Processing
    console.log("\n🔄 Test 2: Fallback Processing...");
    try {
      const fallbackResult = pdfService.fallbackStructuredExtraction(pdfData);

      console.log("✅ Fallback Processing successful!");
      console.log("📄 Document Type:", fallbackResult.documentType);
      console.log("📋 Sections found:", fallbackResult.sections.length);
      console.log("🎯 Confidence:", fallbackResult.confidence);

      // Show sections
      fallbackResult.sections.forEach((section, index) => {
        console.log(`  Section ${index + 1}: ${section.title}`);
        console.log(`    Content lines: ${section.content.length}`);
      });
    } catch (error) {
      console.log("❌ Fallback Processing failed:", error.message);
    }

    // Test 3: Document Classification
    console.log("\n📋 Test 3: Document Classification...");
    const documentTypes = [
      "RESUME\nJohn Doe\nSoftware Engineer",
      "INVOICE\nTotal Amount: $500\nDue Date: 2024-01-15",
      "ABSTRACT\nThis research paper presents...",
      "CONTRACT\nTerms and Conditions\nAgreement between parties",
    ];

    documentTypes.forEach((text, index) => {
      const docType = pdfService.classifyDocumentType(text);
      console.log(`  Document ${index + 1}: ${docType}`);
    });

    // Test 4: Section Identification
    console.log("\n📄 Test 4: Section Identification...");
    const sections = pdfService.identifySections(testText);
    console.log(`Found ${sections.length} sections:`);
    sections.forEach((section, index) => {
      console.log(
        `  ${index + 1}. ${section.title} (${section.content.length} lines)`
      );
    });

    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
testPDFProcessing();
