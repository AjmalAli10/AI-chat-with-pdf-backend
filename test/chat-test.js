const dotenv = require("dotenv");
dotenv.config();

async function testChatAPI() {
  try {
    console.log("🧪 Testing Chat API...");

    // Check environment variables
    console.log(
      "🔑 HUGGINGFACE_API_KEY:",
      process.env.HUGGINGFACE_API_KEY ? "Set" : "Not set"
    );
    console.log("🤖 QWEN_MODEL:", process.env.QWEN_MODEL);

    // Test the chat endpoint
    const response = await fetch("http://localhost:3000/api/chat/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "what is first word",
        fileId: null,
        chatHistory: [],
      }),
    });

    console.log("📡 Response status:", response.status);

    const result = await response.json();
    console.log("📋 Response:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
testChatAPI();
