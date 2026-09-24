const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const setupSockets = require("./sockets");

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Database connection
connectDB();

// Basic Route for testing
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Backend is running" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);

// Error Handling middlewares (simplified for now)
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Redis Adapter Setup for scaling Socket.io
const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = process.env.REDIS_PORT || 6379;

const redisOptions = {
  host: redisHost,
  port: redisPort,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      return null; // Stop retrying
    }
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: null,
};

const pubClient = new Redis(redisOptions);
pubClient.on("error", (err) => {
  // Suppress errors to avoid crashing nodemon
});

const subClient = pubClient.duplicate();
subClient.on("error", (err) => {
  // Suppress errors
});

// We only attach the adapter if Redis connects successfully.
Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Redis Adapter connected and attached to Socket.io");
  })
  .catch((err) => {
    console.warn("Failed to connect to Redis. Running Socket.io in memory.");
  });

// Initialize Socket.io Logic
setupSockets(io);

// Make io accessible globally or pass it to routers/controllers if needed
app.set("io", io);

const PORT = process.env.PORT || 5009;

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other backend process before restarting.`,
    );
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
