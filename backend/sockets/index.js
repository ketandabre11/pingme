const User = require("../models/User");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const jwt = require("jsonwebtoken");

const setupSockets = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Not authorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select(
        "_id name avatar email",
      );
      if (!user) return next(new Error("Not authorized"));

      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log("Connected to socket.io:", socket.id);

    socket.join(socket.user._id.toString());

    // Setup is retained for client compatibility; identity comes from JWT.
    socket.on("setup", () => {
      socket.emit("connected");
      console.log("User joined room:", socket.user._id.toString());
    });

    const canCall = async (chatId, targetUserId) => {
      try {
        if (!chatId || !targetUserId) return false;
        const chat = await Chat.exists({
          _id: chatId,
          users: { $all: [socket.user._id, targetUserId] },
        });
        return Boolean(chat);
      } catch (error) {
        return false;
      }
    };

    socket.on("join chat", (room) => {
      socket.join(room);
      console.log("User Joined Room: " + room);
    });

    socket.on("typing", (room) => socket.in(room).emit("typing"));
    socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

    socket.on("new message", (newMessageRecieved) => {
      var chat = newMessageRecieved.chat;
      if (!chat?.users) return console.log("chat.users not defined");
      const senderId = (
        newMessageRecieved.sender?._id ||
        newMessageRecieved.sender ||
        ""
      ).toString();
      chat.users.forEach((user) => {
        const targetUserId = (user?._id || user || "").toString();
        if (targetUserId === senderId) return;
        socket.in(targetUserId).emit("message recieved", newMessageRecieved);
      });
    });

    socket.on("message delivered", async ({ messageId, userId, chatId }) => {
      // Notify sender immediately for ultra-low latency
      socket
        .in(chatId)
        .emit("status updated", {
          messageId,
          userId,
          status: "delivered",
          chatId,
        });

      try {
        const message = await Message.findById(messageId);
        if (
          message &&
          !message.deliveredTo.some((id) => id.toString() === userId.toString())
        ) {
          message.deliveredTo.push(userId);
          await message.save();
        }
      } catch (error) {
        console.error("Error updating delivered status:", error);
      }
    });

    socket.on("message seen", async ({ messageId, userId, chatId }) => {
      // Notify immediately for ultra-low latency
      socket
        .in(chatId)
        .emit("status updated", { messageId, userId, status: "seen", chatId });

      try {
        const message = await Message.findById(messageId);
        if (
          message &&
          !message.seenBy.some((id) => id.toString() === userId.toString())
        ) {
          message.seenBy.push(userId);
          if (
            !message.deliveredTo.some(
              (id) => id.toString() === userId.toString(),
            )
          ) {
            message.deliveredTo.push(userId);
          }
          await message.save();
        }
      } catch (error) {
        console.error("Error updating seen status:", error);
      }
    });

    socket.on("chat seen", async ({ chatId, userId }) => {
      // Broadcast to everyone in the chat room that this user has seen everything
      socket.in(chatId).emit("chat marked seen", { chatId, userId });

      try {
        // Bulk update in database
        await Message.updateMany(
          { chat: chatId, sender: { $ne: userId }, seenBy: { $ne: userId } },
          { $addToSet: { seenBy: userId, deliveredTo: userId } },
        );
      } catch (error) {
        console.error("Error bulk updating seen status:", error);
      }
    });

    socket.on("message edited", (updatedMessage) => {
      var chat = updatedMessage.chat;
      if (!chat.users) return;
      chat.users.forEach((user) => {
        if (user._id === updatedMessage.sender._id) return;
        socket.in(user._id).emit("message updated", updatedMessage);
      });
    });

    socket.on("message deleted", (deletedMessage) => {
      var chat = deletedMessage.chat;
      if (!chat.users) return;
      chat.users.forEach((user) => {
        if (user._id === deletedMessage.sender._id) return;
        socket.in(user._id).emit("message updated", deletedMessage);
      });
    });

    // Calling feature events
    socket.on("call-user", async ({ userToCall, signalData, chatId, type }) => {
      if (!(await canCall(chatId, userToCall))) return;
      socket.to(userToCall).emit("incoming-call", {
        signal: signalData,
        from: socket.user._id.toString(),
        name: socket.user.name,
        avatar: socket.user.avatar,
        chatId,
        type,
      });
    });

    socket.on("answer-call", async ({ signal, to, chatId }) => {
      if (!(await canCall(chatId, to))) return;
      socket.to(to).emit("call-accepted", signal);
    });

    socket.on("end-call", async ({ to, chatId }) => {
      if (!(await canCall(chatId, to))) return;
      socket.to(to).emit("call-ended");
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
    });
  });
};

module.exports = setupSockets;
