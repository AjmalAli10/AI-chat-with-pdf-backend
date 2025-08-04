const axios = require("axios");

const BASE_URL = "http://localhost:3000";

class SimpleTester {
  constructor() {
    this.testResults = [];
  }

  async testHealthCheck() {
    try {
      console.log("🏥 Testing health check...");
      const response = await axios.get(`${BASE_URL}/health`);

      if (response.status === 200) {
        console.log("✅ Health check passed");
        return true;
      } else {
        console.log("❌ Health check failed");
        return false;
      }
    } catch (error) {
      console.log("❌ Health check failed:", error.message);
      return false;
    }
  }

  async testPDFHealth() {
    try {
      console.log("📄 Testing PDF service health...");
      const response = await axios.get(`${BASE_URL}/api/pdf/health`);

      if (response.status === 200 && response.data.success) {
        console.log("✅ PDF service health check passed");
        return true;
      } else {
        console.log("❌ PDF service health check failed");
        return false;
      }
    } catch (error) {
      console.log("❌ PDF service health check failed:", error.message);
      return false;
    }
  }

  async testGetFiles() {
    try {
      console.log("📁 Testing get files endpoint...");
      const response = await axios.get(`${BASE_URL}/api/pdf/files`);

      if (response.status === 200 && response.data.success) {
        console.log(
          `✅ Get files passed - Found ${response.data.files.length} files`
        );
        return true;
      } else {
        console.log("❌ Get files failed");
        return false;
      }
    } catch (error) {
      console.log("❌ Get files failed:", error.message);
      return false;
    }
  }

  async testServerEndpoints() {
    try {
      console.log("🔗 Testing server endpoints...");

      // Test that server is responding
      const healthResponse = await axios.get(`${BASE_URL}/health`);
      console.log("✅ Server is responding");

      // Test that routes are loaded
      const pdfHealthResponse = await axios.get(`${BASE_URL}/api/pdf/health`);
      console.log("✅ PDF routes are loaded");

      return true;
    } catch (error) {
      console.log("❌ Server endpoints failed:", error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log("🚀 Starting Simple API tests...\n");

    const tests = [
      this.testHealthCheck(),
      this.testPDFHealth(),
      this.testServerEndpoints(),
    ];

    const results = await Promise.all(tests);
    const passed = results.filter(Boolean).length;
    const total = results.length;

    console.log("\n📋 Test Summary:");
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);

    if (passed === total) {
      console.log(
        "\n🎉 All basic tests passed! The server is working correctly."
      );
      console.log(
        "📝 Note: Some features require Hugging Face API key to work fully."
      );
    } else {
      console.log("\n⚠️  Some tests failed. Please check the server.");
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new SimpleTester();
  tester.runAllTests().catch(console.error);
}

module.exports = SimpleTester;
