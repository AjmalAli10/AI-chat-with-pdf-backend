const axios = require("axios");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";

class APITester {
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

  async testGetStats() {
    try {
      console.log("📊 Testing get stats endpoint...");
      const response = await axios.get(`${BASE_URL}/api/pdf/stats`);

      if (response.status === 200 && response.data.success) {
        console.log("✅ Get stats passed");
        console.log(`   - Total files: ${response.data.stats.totalFiles}`);
        console.log(`   - Total chunks: ${response.data.stats.totalChunks}`);
        return true;
      } else {
        console.log("❌ Get stats failed");
        return false;
      }
    } catch (error) {
      console.log("❌ Get stats failed:", error.message);
      return false;
    }
  }

  async testChatQuery() {
    try {
      console.log("💬 Testing chat query endpoint...");
      const response = await axios.post(`${BASE_URL}/api/chat/query`, {
        query: "Hello, how are you?",
        chatHistory: [],
      });

      if (response.status === 200 && response.data.success) {
        console.log("✅ Chat query passed");
        console.log(
          `   - Response: ${response.data.response.substring(0, 100)}...`
        );
        return true;
      } else {
        console.log("❌ Chat query failed");
        return false;
      }
    } catch (error) {
      console.log("❌ Chat query failed:", error.message);
      return false;
    }
  }

  async testSearch() {
    try {
      console.log("🔍 Testing search endpoint...");
      const response = await axios.get(
        `${BASE_URL}/api/chat/search?query=test`
      );

      if (response.status === 200 && response.data.success) {
        console.log("✅ Search passed");
        console.log(`   - Results: ${response.data.totalResults}`);
        return true;
      } else {
        console.log("❌ Search failed");
        return false;
      }
    } catch (error) {
      console.log("❌ Search failed:", error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log("🚀 Starting API tests...\n");

    const tests = [
      this.testHealthCheck(),
      this.testPDFHealth(),
      this.testGetFiles(),
      this.testGetStats(),
      this.testChatQuery(),
      this.testSearch(),
    ];

    const results = await Promise.all(tests);
    const passed = results.filter(Boolean).length;
    const total = results.length;

    console.log("\n📋 Test Summary:");
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);

    if (passed === total) {
      console.log("\n🎉 All tests passed! The API is working correctly.");
    } else {
      console.log(
        "\n⚠️  Some tests failed. Please check the server and try again."
      );
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new APITester();
  tester.runAllTests().catch(console.error);
}

module.exports = APITester;
