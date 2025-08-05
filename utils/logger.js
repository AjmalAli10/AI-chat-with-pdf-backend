// Logger utility for production-safe logging
const isProduction = process.env.NODE_ENV === "production";

class Logger {
  static log(...args) {
    if (!isProduction) {
      console.log(...args);
    }
  }

  static error(...args) {
    if (!isProduction) {
      console.error(...args);
    }
  }

  static warn(...args) {
    if (!isProduction) {
      console.warn(...args);
    }
  }

  static info(...args) {
    if (!isProduction) {
      console.log(...args);
    }
  }

  static debug(...args) {
    if (!isProduction) {
      console.log(...args);
    }
  }
}

module.exports = Logger;
