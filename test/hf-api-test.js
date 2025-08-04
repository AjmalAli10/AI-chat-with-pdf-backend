const dotenv = require("dotenv");
dotenv.config();

async function testHuggingFaceAPI() {
  try {
    console.log("🧪 Testing Hugging Face API directly...");

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    const model = "microsoft/DialoGPT-large"; // Use a different model

    console.log("🔑 API Key:", apiKey ? "Set" : "Not set");
    console.log("🤖 Model:", model);

    // Test the Router API directly
    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content: "Hello, how are you?",
            },
          ],
          model: model,
          stream: false,
          max_tokens: 100,
          temperature: 0.7,
          top_p: 0.9,
        }),
      }
    );

    console.log("📡 Response status:", response.status);
    console.log(
      "📡 Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error:", errorText);
    } else {
      const result = await response.json();
      console.log("✅ API Response:", JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
testHuggingFaceAPI();
