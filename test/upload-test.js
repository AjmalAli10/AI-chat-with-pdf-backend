const fs = require("fs");
const FormData = require("form-data");

async function testPDFUpload() {
  try {
    console.log("🧪 Testing PDF upload functionality...");

    // Check if test file exists
    const testFile = "./test_document.pdf";
    if (!fs.existsSync(testFile)) {
      console.error("❌ Test file not found:", testFile);
      return;
    }

    // Create form data
    const formData = new FormData();
    formData.append("pdf", fs.createReadStream(testFile), "test_document.pdf");

    console.log("📤 Uploading PDF...");

    // Upload the file
    const response = await fetch("http://localhost:3000/api/pdf/upload", {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(),
    });

    console.log("📊 Response status:", response.status);

    const result = await response.json();
    console.log("📋 Response body:", JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("✅ Upload successful!");
      console.log("📄 File ID:", result.data.fileId);
      console.log("📋 Document Type:", result.data.documentType);
      console.log("📊 Sections:", result.data.sections);
      console.log("🔢 Chunks:", result.data.chunks);
      console.log("📝 Summary:", result.data.summary);
    } else {
      console.error("❌ Upload failed:", result.message || result.error);
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Run the test
testPDFUpload();
