const mongoose = require("mongoose");

const messageTranslationSchema = new mongoose.Schema(
  {
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
    },
    sourceLanguage: {
      type: String,
      required: true,
    },
    targetLanguage: {
      type: String,
      required: true,
    },
    translatedText: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

messageTranslationSchema.index(
  { message: 1, sourceLanguage: 1, targetLanguage: 1 },
  { unique: true },
);

module.exports = mongoose.model("MessageTranslation", messageTranslationSchema);
