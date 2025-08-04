const dotenv = require("dotenv");
const { InferenceClient } = require("@huggingface/inference");
dotenv.config();

async function testNERModel() {
  try {
    console.log("🧪 Testing NER Model...");

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    const model = "dslim/bert-base-NER";

    console.log("🔑 API Key:", apiKey ? "Set" : "Not set");
    console.log("🤖 Model:", model);

    if (!apiKey) {
      console.error(
        "❌ No Hugging Face API key found in environment variables"
      );
      return;
    }

    const client = new InferenceClient(apiKey);

    // Test text - a resume-like document
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

    console.log("📄 Test Text:", testText);

    try {
      // Test the NER model
      const output = await client.tokenClassification({
        model: model,
        inputs: testText,
        provider: "auto",
      });

      console.log("✅ NER Model works!");
      console.log("📡 Response type:", typeof output);
      console.log("📊 Response length:", output.length);

      if (output.length > 0) {
        console.log("📝 Sample entities:");
        output.slice(0, 5).forEach((entity) => {
          console.log(
            `  - ${entity.word} (${entity.entity_group}) - Score: ${entity.score}`
          );
        });

        // Group entities by type
        const entityGroups = {};
        output.forEach((entity) => {
          const type = entity.entity_group;
          if (!entityGroups[type]) {
            entityGroups[type] = [];
          }
          entityGroups[type].push({
            text: entity.word,
            score: entity.score,
          });
        });

        console.log("\n📋 Entity Groups:");
        Object.keys(entityGroups).forEach((type) => {
          console.log(`  ${type}: ${entityGroups[type].length} entities`);
          console.log(
            `    Sample: ${entityGroups[type]
              .slice(0, 3)
              .map((e) => e.text)
              .join(", ")}`
          );
        });

        // Calculate confidence
        const avgScore =
          output.reduce((sum, entity) => sum + entity.score, 0) / output.length;
        console.log(`\n🎯 Average Confidence: ${(avgScore * 100).toFixed(1)}%`);
      } else {
        console.log("⚠️ No entities found in the text");
      }
    } catch (error) {
      console.error("❌ NER Model failed:", error.message);
      if (error.response) {
        console.error("📡 Status:", error.response.status);
        console.error("📄 Response:", error.response.data);
      }
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
testNERModel();
