const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default:
        "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
    },
    about: {
      type: String,
      default: "Hey there! I am using PingMe.",
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    preferences: {
      notifications: { type: Boolean, default: true },
      lastSeen: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      profilePhoto: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      about: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      readReceipts: { type: Boolean, default: true },
      theme: { type: String, default: "dark" },
      translationLanguage: {
        type: String,
        enum: [
          "en",
          "hi",
          "mr",
          "ja",
          "es",
          "fr",
          "de",
          "it",
          "pt",
          "zh",
          "ar",
          "bn",
          "bg",
          "ca",
          "cs",
          "da",
          "el",
          "et",
          "fa",
          "fi",
          "he",
          "hr",
          "hu",
          "id",
          "ko",
          "lt",
          "lv",
          "ms",
          "nl",
          "no",
          "pl",
          "ro",
          "ru",
          "sk",
          "sl",
          "sr",
          "sv",
          "ta",
          "te",
          "th",
          "tr",
          "uk",
          "ur",
          "vi",
        ],
        default: "en",
      },
    },
    blockedContacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
