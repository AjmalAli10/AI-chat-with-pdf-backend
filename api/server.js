const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
require("dotenv").config();

const pdfRoutes = require("../routes/pdfRoutes");
const chatRoutes = require("../routes/chatRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request abort detection middleware
app.use((req, res, next) => {
  const controller = new AbortController();

  // Add abort controller to request
  req.abortController = controller;

  // Track client disconnect - only abort if client actually disconnects
  let responseSent = false;

  res.on("finish", () => {
    responseSent = true;
  });

  res.on("close", () => {
    // Only abort if the response hasn't been sent yet (client disconnected early)
    if (!responseSent) {
      console.log("❌ Client disconnected, aborting request");
      controller.abort();
    }
  });

  // Set a global timeout for all requests (10 minutes)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.log("⏰ Request timeout reached");
      controller.abort();
      res.status(408).json({ error: "Request timeout" });
    }
  }, 10 * 60 * 1000); // 10 minutes

  // Clear timeout when request completes
  res.on("finish", () => {
    clearTimeout(timeout);
  });

  res.on("close", () => {
    clearTimeout(timeout);
  });

  next();
});

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.use("/api/pdf", pdfRoutes);
app.use("/api/chat", chatRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Uploads: http://localhost:${PORT}/uploads`);
});
