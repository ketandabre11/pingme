const Message = require("../models/Message");
const User = require("../models/User");
const Chat = require("../models/Chat");
const MessageTranslation = require("../models/MessageTranslation");
const {
  SUPPORTED_LANGUAGES,
  detectLanguage,
  translateText,
} = require("../services/translationService");

const translationRequests = new Map();

// @desc    Get all messages
// @route   GET /api/messages/:chatId
// @access  Private
const allMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name avatar email")
      .populate("chat")
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: "name avatar" },
      });
    res.json(messages);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Create new message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  const { content, chatId, replyTo } = req.body;

  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
    replyTo: replyTo || null,
  };

  try {
    if (replyTo) {
      const repliedMessage = await Message.findOne({
        _id: replyTo,
        chat: chatId,
      }).select("_id");
      if (!repliedMessage) {
        return res.status(400).json({ message: "Invalid reply message" });
      }
    }

    var message = await Message.create(newMessage);

    message = await message.populate("sender", "name avatar");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name avatar email",
    });
    message = await message.populate({
      path: "replyTo",
      populate: { path: "sender", select: "name avatar" },
    });

    await Chat.findByIdAndUpdate(req.body.chatId, {
      latestMessage: message,
    });

    res.json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Mark messages as seen
// @route   PUT /api/messages/seen/:chatId
// @access  Private
const markMessagesAsSeen = async (req, res) => {
  try {
    const { chatId } = req.params;

    // Find messages in the chat where this user is NOT in the seenBy array
    // and the sender is NOT this user
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user._id },
        seenBy: { $ne: req.user._id },
      },
      {
        $push: { seenBy: req.user._id },
      },
    );

    res.json({ message: "Messages marked as seen" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Edit message
// @route   PUT /api/messages/edit
// @access  Private
const editMessage = async (req, res) => {
  const { messageId, content } = req.body;

  try {
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message Not Found" });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res
        .status(401)
        .json({ message: "You can only edit your own messages" });
    }

    message.content = content;
    message.isEdited = true;
    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate("sender", "name avatar")
      .populate("chat");

    res.json(updatedMessage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete message (Soft Delete)
// @route   PUT /api/messages/delete
// @access  Private
const deleteMessage = async (req, res) => {
  const { messageId } = req.body;

  try {
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message Not Found" });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res
        .status(401)
        .json({ message: "You can only delete your own messages" });
    }

    message.content = "This message was deleted";
    message.isDeleted = true;
    await message.save();

    res.json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const translateMessage = async (req, res) => {
  try {
    const { targetLanguage, sourceText } = req.body;
    const { messageId } = req.params;

    if (!SUPPORTED_LANGUAGES.has(targetLanguage)) {
      return res
        .status(400)
        .json({ message: "Unsupported translation language" });
    }
    if (typeof sourceText !== "string" || !sourceText.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const message =
      await Message.findById(messageId).select("_id chat isDeleted");
    if (!message || message.isDeleted)
      return res.status(404).json({ message: "Message not found" });

    const hasAccess = await Chat.exists({
      _id: message.chat,
      users: req.user._id,
    });
    if (!hasAccess)
      return res
        .status(403)
        .json({ message: "Not authorized to translate this message" });

    const sourceLanguage = detectLanguage(sourceText.trim());
    if (sourceLanguage === targetLanguage) {
      return res.json({
        sourceLanguage,
        targetLanguage,
        translatedText: sourceText.trim(),
        unchanged: true,
      });
    }

    const cached = await MessageTranslation.findOne({
      message: message._id,
      sourceLanguage,
      targetLanguage,
    });
    if (cached) {
      return res.json({
        sourceLanguage,
        targetLanguage,
        translatedText: cached.translatedText,
        cached: true,
      });
    }

    const requestKey = `${message._id}:${sourceLanguage}:${targetLanguage}:${sourceText.trim()}`;
    let translationRequest = translationRequests.get(requestKey);
    if (!translationRequest) {
      translationRequest = (async () => {
        const translatedText = await translateText(
          sourceText.trim(),
          sourceLanguage,
          targetLanguage,
        );
        return MessageTranslation.findOneAndUpdate(
          { message: message._id, sourceLanguage, targetLanguage },
          { translatedText },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      })();
      translationRequests.set(requestKey, translationRequest);
      translationRequest.then(
        () => translationRequests.delete(requestKey),
        () => translationRequests.delete(requestKey),
      );
    }
    const translation = await translationRequest;

    res.json({
      sourceLanguage,
      targetLanguage,
      translatedText: translation.translatedText,
      cached: false,
    });
  } catch (error) {
    console.error("Translation failed:", error.message);
    res.status(503).json({
      message: "Translation is temporarily unavailable. Please try again.",
    });
  }
};

module.exports = {
  allMessages,
  sendMessage,
  markMessagesAsSeen,
  editMessage,
  deleteMessage,
  translateMessage,
};
