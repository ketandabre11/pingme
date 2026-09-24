import { useEffect, useState, useRef } from "react";
import axios from "../utils/axiosConfig";
import useAuthStore from "../store/authStore";
import useChatStore from "../store/chatStore";
import {
  Send,
  Check,
  CheckCheck,
  ArrowLeft,
  Star,
  MoreVertical,
  Edit2,
  Trash2,
  Reply,
  Smile,
  Pin,
  Forward,
  Copy,
  Languages,
  Info,
  CheckSquare,
  X,
  Lock,
  Video,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { encryptMessage, decryptMessage } from "../utils/cryptoUtils";

const ChatWindow = () => {
  const { user, updateSettings } = useAuthStore();
  const {
    selectedChat,
    setSelectedChat,
    messages,
    setMessages,
    addMessage,
    updateChatLatestMessage,
    socket,
    setShowGroupSettings,
    setCall,
  } = useChatStore();

  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [showMsgOptions, setShowMsgOptions] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [starredMessages, setStarredMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [reactions, setReactions] = useState({});
  const [messageMenuPosition, setMessageMenuPosition] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [forwardedMessage, setForwardedMessage] = useState(null);
  const [translations, setTranslations] = useState({});
  const [translatingMessage, setTranslatingMessage] = useState(null);
  const [translationError, setTranslationError] = useState(null);
  const [showOriginalTranslation, setShowOriginalTranslation] = useState({});

  const hideTranslation = (messageId) => {
    setTranslations((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
    setShowOriginalTranslation((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
  };

  const messagesContainerRef = useRef(null);
  const selectedChatRef = useRef(selectedChat);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (!infoMessage?._id) return;
    const currentMessage = messages.find(
      (message) => message._id === infoMessage._id,
    );
    if (currentMessage && currentMessage !== infoMessage) {
      setInfoMessage(currentMessage);
    }
  }, [messages, infoMessage]);

  useEffect(() => {
    if (!showMsgOptions) return;

    const closeMessageMenu = (event) => {
      if (
        event.target.closest?.(".message-action-menu") ||
        event.target.closest?.(".msg-chevron")
      ) {
        return;
      }
      setShowMsgOptions(null);
      setMessageMenuPosition(null);
    };

    document.addEventListener("pointerdown", closeMessageMenu);
    return () => document.removeEventListener("pointerdown", closeMessageMenu);
  }, [showMsgOptions]);

  const scrollToBottom = () => {
    const messagesContainer = messagesContainerRef.current;
    if (messagesContainer) {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const decryptReply = (message, chatId = selectedChat?._id) => {
    if (!message?.replyTo) return message;
    const replyChatId = message.chat?._id || message.chat || chatId;
    return {
      ...message,
      replyTo: {
        ...message.replyTo,
        content: decryptMessage(message.replyTo.content, replyChatId),
      },
    };
  };

  useEffect(() => {
    if (!socket) return;
    setSocketConnected(true);

    const onTyping = () => setIsTyping(true);
    const onStopTyping = () => setIsTyping(false);

    socket.on("typing", onTyping);
    socket.on("stop typing", onStopTyping);

    return () => {
      socket.off("typing", onTyping);
      socket.off("stop typing", onStopTyping);
    };
  }, [socket]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChat?._id) return;
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/messages/${selectedChat._id}`);
        // Decrypt messages safely
        const decryptedMessages = (data || []).map((msg) =>
          decryptReply(
            {
              ...msg,
              content: decryptMessage(msg.content, selectedChat._id),
            },
            selectedChat._id,
          ),
        );
        setMessages(decryptedMessages);
        setLoading(false);

        if (socket) {
          socket.emit("join chat", selectedChat._id);
          // Mark all as seen immediately via socket
          socket.emit("chat seen", {
            chatId: selectedChat._id,
            userId: user?._id,
          });
        }

        // Sync with DB in background
        axios
          .put(`/api/messages/seen/${selectedChat._id}`)
          .catch((err) => console.error(err));
      } catch (error) {
        console.error("Failed to load messages", error);
        setLoading(false);
      }
    };

    fetchMessages();
  }, [selectedChat?._id, socket, user?._id, setMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (newMessageRecieved) => {
      updateChatLatestMessage(newMessageRecieved);

      if (
        !selectedChatRef.current ||
        selectedChatRef.current._id !== newMessageRecieved?.chat?._id
      ) {
        // Notification logic if chat isn't currently open
      } else {
        // Decrypt received message
        const decryptedMsg = decryptReply(
          {
            ...newMessageRecieved,
            content: decryptMessage(
              newMessageRecieved.content,
              newMessageRecieved.chat._id,
            ),
          },
          newMessageRecieved.chat._id,
        );
        addMessage(decryptedMsg);

        // Emit seen event immediately if chat is open
        socket.emit("message seen", {
          messageId: newMessageRecieved._id,
          userId: user?._id,
          chatId: newMessageRecieved.chat._id,
        });
      }
    };

    const handleStatusUpdated = ({ messageId, status, userId }) => {
      setMessages((prev) =>
        (prev || []).map((m) => {
          if (m._id === messageId) {
            const updatedMsg = { ...m };
            if (
              status === "seen" &&
              (!updatedMsg.seenBy || !updatedMsg.seenBy.includes(userId))
            ) {
              updatedMsg.seenBy = [...(updatedMsg.seenBy || []), userId];
            }
            if (
              status === "delivered" &&
              (!updatedMsg.deliveredTo ||
                !updatedMsg.deliveredTo.includes(userId))
            ) {
              updatedMsg.deliveredTo = [
                ...(updatedMsg.deliveredTo || []),
                userId,
              ];
            }
            return updatedMsg;
          }
          return m;
        }),
      );
    };

    const handleChatMarkedSeen = ({ chatId, userId }) => {
      if (selectedChatRef.current && selectedChatRef.current._id === chatId) {
        setMessages((prev) =>
          (prev || []).map((m) => {
            if (
              m?.sender?._id !== userId &&
              (!m.seenBy || !m.seenBy.includes(userId))
            ) {
              return {
                ...m,
                seenBy: [...(m.seenBy || []), userId],
                deliveredTo: [...(m.deliveredTo || []), userId],
              };
            }
            return m;
          }),
        );
      }
    };

    const handleMessageUpdated = (updatedMessage) => {
      if (
        selectedChatRef.current &&
        selectedChatRef.current._id === updatedMessage?.chat?._id
      ) {
        const decryptedMsg = {
          ...updatedMessage,
          content: decryptMessage(
            updatedMessage.content,
            updatedMessage.chat._id,
          ),
        };
        setMessages((prev) =>
          (prev || []).map((m) =>
            m._id === updatedMessage._id ? decryptedMsg : m,
          ),
        );
      }
    };

    socket.on("message recieved", handleMessageReceived);
    socket.on("status updated", handleStatusUpdated);
    socket.on("chat marked seen", handleChatMarkedSeen);
    socket.on("message updated", handleMessageUpdated);

    return () => {
      socket.off("message recieved", handleMessageReceived);
      socket.off("status updated", handleStatusUpdated);
      socket.off("chat marked seen", handleChatMarkedSeen);
      socket.off("message updated", handleMessageUpdated);
    };
  }, [socket, user?._id, addMessage, setMessages, updateChatLatestMessage]);

  const sendMessage = async (e) => {
    if (e.key === "Enter" && newMessage.trim()) {
      if (socket && selectedChat?._id) {
        socket.emit("stop typing", selectedChat._id);
      }
      try {
        const text = newMessage.trim();
        const encryptedContent = encryptMessage(text, selectedChat?._id);
        const displayContent = text;
        setNewMessage("");
        const { data } = await axios.post("/api/messages", {
          content: encryptedContent,
          chatId: selectedChat?._id,
          replyTo: replyTo?._id,
        });
        if (socket) socket.emit("new message", data);
        updateChatLatestMessage(data);
        addMessage(
          decryptReply({ ...data, content: displayContent }, selectedChat._id),
        );
        setReplyTo(null);
        setForwardedMessage(null);
      } catch (error) {
        console.error("Failed to send message", error);
      }
    }
  };

  const sendButtonClicked = async () => {
    if (editingMessage) {
      handleEditMessage();
      return;
    }
    if (newMessage.trim()) {
      if (socket && selectedChat?._id) {
        socket.emit("stop typing", selectedChat._id);
      }
      try {
        const text = newMessage.trim();
        const encryptedContent = encryptMessage(text, selectedChat?._id);
        const displayContent = text;
        setNewMessage("");
        const { data } = await axios.post("/api/messages", {
          content: encryptedContent,
          chatId: selectedChat?._id,
          replyTo: replyTo?._id,
        });
        if (socket) socket.emit("new message", data);
        updateChatLatestMessage(data);
        addMessage(
          decryptReply({ ...data, content: displayContent }, selectedChat._id),
        );
        setReplyTo(null);
        setForwardedMessage(null);
      } catch (error) {
        console.error("Failed to send message", error);
      }
    }
  };

  const handleEditMessage = async () => {
    if (!editContent || !editingMessage || !selectedChat?._id) return;
    try {
      const encryptedContent = encryptMessage(editContent, selectedChat._id);
      const { data } = await axios.put("/api/messages/edit", {
        messageId: editingMessage._id,
        content: encryptedContent,
      });
      // Update message in store with raw content for display
      const updatedMessages = (messages || []).map((m) =>
        m._id === data._id ? { ...data, content: editContent } : m,
      );
      setMessages(updatedMessages);
      setEditingMessage(null);
      setEditContent("");
      // Notify via socket
      if (socket) socket.emit("message edited", data);
    } catch (error) {
      console.error("Error editing message", error);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const { data } = await axios.put("/api/messages/delete", { messageId });
      const updatedMessages = (messages || []).map((m) =>
        m._id === data._id ? data : m,
      );
      setMessages(updatedMessages);
      setShowMsgOptions(null);
      // Notify via socket
      if (socket) socket.emit("message deleted", data);
    } catch (error) {
      console.error("Error deleting message", error);
    }
  };

  const toggleSelectedMessage = (messageId) => {
    setSelectedMessages((current) =>
      current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId],
    );
  };

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content || "");
    } catch (error) {
      console.error("Failed to copy message", error);
    }
    setShowMsgOptions(null);
  };

  const forwardMessage = (message) => {
    setNewMessage(message.content || "");
    setReplyTo(null);
    setForwardedMessage(message);
    setShowMsgOptions(null);
    setMessageMenuPosition(null);
  };

  const translateMessage = async (message) => {
    const targetLanguage = user?.preferences?.translationLanguage || "en";
    setShowMsgOptions(null);
    setMessageMenuPosition(null);
    setTranslationError(null);

    const cachedTranslation = translations[message._id];
    if (cachedTranslation?.targetLanguage === targetLanguage) {
      return;
    }

    setTranslatingMessage(message._id);
    try {
      const { data } = await axios.post(
        `/api/messages/${message._id}/translate`,
        {
          targetLanguage,
          sourceText: message.content,
        },
      );
      setTranslations((current) => ({ ...current, [message._id]: data }));
    } catch (error) {
      setTranslationError({
        messageId: message._id,
        text: "Translation is temporarily unavailable. Please try again.",
      });
    } finally {
      setTranslatingMessage(null);
    }
  };

  const toggleReaction = (messageId) => {
    setReactions((current) => ({
      ...current,
      [messageId]: current[messageId] === "❤️" ? null : "❤️",
    }));
    setShowMsgOptions(null);
    setMessageMenuPosition(null);
  };

  const toggleMessageMenu = (event, messageId) => {
    if (showMsgOptions === messageId) {
      setShowMsgOptions(null);
      setMessageMenuPosition(null);
      return;
    }

    const bubble = event.currentTarget.closest(".message-bubble");
    const chatArea = messagesContainerRef.current?.getBoundingClientRect();
    if (!bubble || !chatArea) return;

    const bubbleRect = bubble.getBoundingClientRect();
    const menuWidth = 150;
    const menuHeight = 390;
    const edge = 8;
    const left = Math.min(
      Math.max(chatArea.left + edge, bubbleRect.right - menuWidth),
      chatArea.right - menuWidth - edge,
    );
    const belowTop = bubbleRect.bottom + 4;
    const aboveTop = bubbleRect.top - menuHeight - 4;
    const top =
      belowTop + menuHeight <= chatArea.bottom - edge
        ? belowTop
        : Math.max(chatArea.top + edge, aboveTop);

    setMessageMenuPosition({
      left: Math.max(chatArea.left + edge, left),
      top,
    });
    setShowMsgOptions(messageId);
  };

  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected || !socket || !selectedChat?._id) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChat._id);
    }

    let lastTypingTime = new Date().getTime();
    const timerLength = 3000;
    setTimeout(() => {
      const timeNow = new Date().getTime();
      const timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        if (socket && selectedChat?._id) {
          socket.emit("stop typing", selectedChat._id);
        }
        setTyping(false);
      }
    }, timerLength);
  };

  const getSender = (chat) => {
    if (!chat) return { name: "", avatar: "", isGroup: false };
    if (chat.isGroupChat)
      return {
        name: chat.chatName || "Group",
        avatar:
          chat.groupIcon &&
          chat.groupIcon !==
            "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"
            ? chat.groupIcon
            : `https://ui-avatars.com/api/?name=${chat.chatName || "Group"}&background=random`,
        isGroup: true,
        users: chat.users || [],
      };
    if (!chat.users || !Array.isArray(chat.users) || chat.users.length === 0) {
      return {
        name: "User",
        avatar:
          "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
        isGroup: false,
      };
    }
    const otherUser =
      chat.users[0]?._id === user?._id ? chat.users[1] : chat.users[0];
    return (
      otherUser || {
        name: "User",
        avatar:
          "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
        isGroup: false,
      }
    );
  };

  const sender = getSender(selectedChat);
  const isFavorite = Boolean(
    user?.favorites?.some((f) => (f?._id || f) === sender?._id),
  );
  const isInfoMessageMine =
    infoMessage?.sender?._id === user?._id || infoMessage?.sender === user?._id;

  const toggleFavorite = async () => {
    if (!sender?._id) return;
    try {
      const { data } = await axios.post("/api/users/favorites", {
        targetUserId: sender._id,
      });
      updateSettings({ favorites: data });
    } catch (error) {
      console.error("Failed to toggle favorite", error);
    }
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? "" : format(date, "p");
    } catch {
      return "";
    }
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "transparent",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: "var(--header-height)",
          padding: "0 1.5rem",
          background: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            cursor: sender?.isGroup ? "pointer" : "default",
          }}
          onClick={() => sender?.isGroup && setShowGroupSettings(true)}
        >
          <button
            className="md:hidden"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedChat(null);
            }}
          >
            <ArrowLeft size={24} />
          </button>
          <img
            src={
              sender?.avatar ||
              "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"
            }
            alt={sender?.name || "Avatar"}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
          <div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <div style={{ fontWeight: "600", fontSize: "1.1rem" }}>
                {sender?.name || "Chat"}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "rgba(16, 185, 129, 0.1)",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                }}
              >
                <Lock size={10} color="var(--success)" />
                <span
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--success)",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  E2EE
                </span>
              </div>
            </div>
            {isTyping ? (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--accent-primary)",
                  fontStyle: "italic",
                }}
              >
                typing...
              </div>
            ) : sender?.isGroup ? (
              <div
                style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}
              >
                {sender?.users?.length || 0} members
              </div>
            ) : (
              <div
                style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}
              >
                {sender?.isOnline ? "Online" : sender?.about || "Available"}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          {!sender?.isGroup && sender?._id && (
            <>
              <button
                onClick={() =>
                  setCall({
                    isReceivingCall: false,
                    from: sender._id,
                    name: sender.name,
                    avatar: sender.avatar,
                    chatId: selectedChat._id,
                    signal: null,
                    type: "voice",
                  })
                }
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "var(--transition)",
                }}
                title="Voice Call"
                onMouseOver={(e) =>
                  (e.currentTarget.style.color = "var(--accent-primary)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
              >
                <Phone size={22} />
              </button>
              <button
                onClick={() =>
                  setCall({
                    isReceivingCall: false,
                    from: sender._id,
                    name: sender.name,
                    avatar: sender.avatar,
                    chatId: selectedChat._id,
                    signal: null,
                    type: "video",
                  })
                }
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "var(--transition)",
                }}
                title="Video Call"
                onMouseOver={(e) =>
                  (e.currentTarget.style.color = "var(--accent-primary)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
              >
                <Video size={22} />
              </button>
              <button
                onClick={toggleFavorite}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "var(--transition)",
                }}
                title={
                  isFavorite ? "Remove from Favorites" : "Add to Favorites"
                }
              >
                <Star
                  size={24}
                  fill={isFavorite ? "var(--warning)" : "none"}
                  color={
                    isFavorite ? "var(--warning)" : "var(--text-secondary)"
                  }
                />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          padding: "1.5rem",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        {loading ? (
          <div
            className="flex-center"
            style={{ height: "100%", color: "var(--text-secondary)" }}
          >
            Loading messages...
          </div>
        ) : (
          (messages || []).map((m, idx) => {
            const senderId = (m?.sender?._id || m?.sender || "").toString();
            const currentUserId = (user?._id || "").toString();
            const isMyMessage = Boolean(
              senderId && currentUserId && senderId === currentUserId,
            );
            const msgKey = m?._id ? m._id.toString() : `msg-${idx}`;

            return (
              <div
                key={msgKey}
                onClick={() =>
                  selectedMessages.length > 0 && toggleSelectedMessage(m._id)
                }
                style={{
                  display: "flex",
                  justifyContent: isMyMessage ? "flex-end" : "flex-start",
                  position: "relative",
                  background: selectedMessages.includes(m._id)
                    ? "rgba(59, 130, 246, 0.18)"
                    : "transparent",
                  borderRadius: "8px",
                }}
              >
                {!isMyMessage && selectedChat?.isGroupChat && (
                  <img
                    src={
                      m?.sender?.avatar ||
                      "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"
                    }
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      marginRight: "0.5rem",
                      marginTop: "auto",
                    }}
                    title={m?.sender?.name || ""}
                    alt="sender"
                  />
                )}
                <div
                  className="message-bubble"
                  style={{
                    maxWidth: "75%",
                    padding: "0.2rem 2rem 0.2rem 0.65rem",
                    borderRadius: "16px",
                    background: isMyMessage
                      ? "var(--accent-primary)"
                      : "var(--bg-tertiary)",
                    color: isMyMessage ? "#fff" : "var(--text-primary)",
                    borderBottomRightRadius: isMyMessage ? "4px" : "16px",
                    borderBottomLeftRadius: !isMyMessage ? "4px" : "16px",
                    boxShadow: "var(--shadow-sm)",
                    position: "relative",
                  }}
                >
                  {m?.replyTo && (
                    <div
                      style={{
                        marginBottom: "0.25rem",
                        padding: "0.25rem 0.4rem",
                        borderLeft: "2px solid var(--accent-primary)",
                        background: "rgba(255,255,255,0.12)",
                        fontSize: "0.7rem",
                        opacity: 0.85,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.replyTo.sender?.name || "Message"}: {m.replyTo.content}
                    </div>
                  )}
                  {pinnedMessages.includes(m._id) && (
                    <div
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--warning)",
                        marginBottom: "0.15rem",
                      }}
                    >
                      Pinned
                    </div>
                  )}
                  {!isMyMessage && selectedChat?.isGroupChat && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        marginBottom: "0.25rem",
                        color: "var(--accent-primary)",
                      }}
                    >
                      {m?.sender?.name || "User"}
                    </div>
                  )}
                  <div
                    style={{
                      wordBreak: "break-word",
                      lineHeight: 1.15,
                      fontStyle: m?.isDeleted ? "italic" : "normal",
                      opacity: m?.isDeleted ? 0.7 : 1,
                    }}
                  >
                    {typeof m?.content === "object" && m?.content !== null
                      ? JSON.stringify(m.content)
                      : String(m?.content ?? "")}
                    {m?.isEdited && !m?.isDeleted && (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          marginLeft: "0.5rem",
                          opacity: 0.6,
                        }}
                      >
                        (edited)
                      </span>
                    )}
                  </div>
                  {translatingMessage === m._id && (
                    <div
                      style={{
                        marginTop: "0.35rem",
                        fontSize: "0.7rem",
                        opacity: 0.75,
                      }}
                    >
                      Translating...
                    </div>
                  )}
                  {translations[m._id] && translatingMessage !== m._id && (
                    <div
                      style={{
                        marginTop: "0.35rem",
                        paddingTop: "0.35rem",
                        borderTop: "1px solid rgba(255,255,255,0.18)",
                        fontSize: "0.78rem",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.62rem",
                          opacity: 0.7,
                          marginBottom: "0.15rem",
                        }}
                      >
                        {translations[m._id].unchanged
                          ? "Already in your language"
                          : "Translation"}
                      </div>
                      {!translations[m._id].unchanged && (
                        <>
                          <div
                            onClick={() => hideTranslation(m._id)}
                            title="Hide translation"
                            style={{ cursor: "pointer" }}
                          >
                            {showOriginalTranslation[m._id]
                              ? m.content
                              : translations[m._id].translatedText}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setShowOriginalTranslation((current) => ({
                                ...current,
                                [m._id]: !current[m._id],
                              }))
                            }
                            style={{
                              marginTop: "0.25rem",
                              padding: 0,
                              border: 0,
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                              fontSize: "0.65rem",
                              textDecoration: "underline",
                            }}
                          >
                            {showOriginalTranslation[m._id]
                              ? "Show translation"
                              : "Show original"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {translationError?.messageId === m._id && (
                    <div
                      style={{
                        marginTop: "0.35rem",
                        fontSize: "0.68rem",
                        color: "#fca5a5",
                      }}
                    >
                      {translationError.text}
                    </div>
                  )}
                  {reactions[m._id] && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: "-8px",
                        left: "8px",
                        fontSize: "0.8rem",
                      }}
                    >
                      {reactions[m._id]}
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: "0.55rem",
                      textAlign: isMyMessage ? "right" : "left",
                      lineHeight: 1,
                      marginTop: "0.05rem",
                      marginRight: isMyMessage ? "-1.35rem" : 0,
                      color: isMyMessage
                        ? "rgba(255,255,255,0.7)"
                        : "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: isMyMessage ? "flex-end" : "flex-start",
                      gap: "4px",
                    }}
                  >
                    {formatMessageTime(m?.createdAt)}
                    {isMyMessage && !m?.isDeleted && (
                      <span style={{ display: "flex", alignItems: "center" }}>
                        {Array.isArray(m?.seenBy) && m.seenBy.length > 0 ? (
                          <CheckCheck size={14} style={{ color: "#34d399" }} />
                        ) : Array.isArray(m?.deliveredTo) &&
                          m.deliveredTo.length > 0 ? (
                          <CheckCheck size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                      </span>
                    )}
                  </div>

                  {m?._id && !m.isDeleted && (
                    <div
                      onClick={(event) => toggleMessageMenu(event, m._id)}
                      style={{
                        position: "absolute",
                        right: "6px",
                        top: "6px",
                        width: "18px",
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        opacity: showMsgOptions === m._id ? 1 : 0,
                        transition: "opacity 0.2s",
                        zIndex: 2,
                      }}
                      className="msg-chevron"
                    >
                      <MoreVertical
                        size={14}
                        style={{
                          color: isMyMessage
                            ? "rgba(255,255,255,0.8)"
                            : "var(--text-secondary)",
                        }}
                      />
                    </div>
                  )}

                  {m?._id && !m.isDeleted && showMsgOptions === m._id && (
                    <div
                      className="message-action-menu"
                      style={{
                        position: "fixed",
                        top: messageMenuPosition?.top ?? 0,
                        left: messageMenuPosition?.left ?? 0,
                        zIndex: 10,
                        minWidth: "150px",
                      }}
                    >
                      <button
                        onClick={() => {
                          setReplyTo(m);
                          setShowMsgOptions(null);
                        }}
                        style={{
                          padding: "0.6rem 1rem",
                          background: "none",
                          border: "none",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "0.85rem",
                        }}
                        className="message-action-item"
                      >
                        <Reply size={12} /> Reply
                      </button>
                      <button
                        onClick={() => toggleReaction(m._id)}
                        style={{
                          padding: "0.6rem 1rem",
                          background: "none",
                          border: "none",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "0.85rem",
                        }}
                        className="message-action-item"
                      >
                        <Smile size={12} /> React
                      </button>
                      <button
                        onClick={() => {
                          setStarredMessages((current) =>
                            current.includes(m._id)
                              ? current.filter((id) => id !== m._id)
                              : [...current, m._id],
                          );
                          setShowMsgOptions(null);
                        }}
                        style={{
                          padding: "0.6rem 1rem",
                          background: "none",
                          border: "none",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "0.85rem",
                        }}
                        className="message-action-item"
                      >
                        <Star
                          size={12}
                          fill={
                            starredMessages.includes(m._id)
                              ? "currentColor"
                              : "none"
                          }
                        />{" "}
                        {starredMessages.includes(m._id) ? "Unstar" : "Star"}
                      </button>
                      <button
                        onClick={() => {
                          setPinnedMessages((current) =>
                            current.includes(m._id)
                              ? current.filter((id) => id !== m._id)
                              : [...current, m._id],
                          );
                          setShowMsgOptions(null);
                        }}
                        style={{
                          padding: "0.6rem 1rem",
                          background: "none",
                          border: "none",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "0.85rem",
                        }}
                        className="message-action-item"
                      >
                        <Pin size={12} />{" "}
                        {pinnedMessages.includes(m._id) ? "Unpin" : "Pin"}
                      </button>
                      <button
                        onClick={() => forwardMessage(m)}
                        style={{
                          padding: "0.6rem 1rem",
                          background: "none",
                          border: "none",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "0.85rem",
                        }}
                        className="message-action-item"
                      >
                        <Forward size={12} /> Forward
                      </button>
                      {!isMyMessage && (
                        <button
                          onClick={() => translateMessage(m)}
                          disabled={translatingMessage === m._id}
                          style={{
                            padding: "0.6rem 1rem",
                            background: "none",
                            border: "none",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "0.85rem",
                            opacity: translatingMessage === m._id ? 0.6 : 1,
                          }}
                          className="message-action-item"
                        >
                          <Languages size={12} />{" "}
                          {translatingMessage === m._id
                            ? "Translating..."
                            : "Translate"}
                        </button>
                      )}
                      <button
                        onClick={() => copyMessage(m)}
                        style={{
                          padding: "0.6rem 1rem",
                          background: "none",
                          border: "none",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "0.85rem",
                        }}
                        className="message-action-item"
                      >
                        <Copy size={12} /> Copy
                      </button>
                      {isMyMessage && (
                        <button
                          onClick={() => {
                            setInfoMessage(m);
                            setShowMsgOptions(null);
                            setMessageMenuPosition(null);
                          }}
                          style={{
                            padding: "0.6rem 1rem",
                            background: "none",
                            border: "none",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "0.85rem",
                          }}
                          className="message-action-item"
                        >
                          <Info size={12} /> Info
                        </button>
                      )}
                      <button
                        onClick={() => {
                          toggleSelectedMessage(m._id);
                          setShowMsgOptions(null);
                        }}
                        style={{
                          padding: "0.6rem 1rem",
                          background: "none",
                          border: "none",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "0.85rem",
                        }}
                        className="message-action-item"
                      >
                        <CheckSquare size={12} /> Select messages
                      </button>
                      {isMyMessage && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMessage(m);
                              setEditContent(m.content);
                              setShowMsgOptions(null);
                            }}
                            style={{
                              padding: "0.6rem 1rem",
                              background: "none",
                              border: "none",
                              color: "var(--text-primary)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "0.85rem",
                            }}
                            className="message-action-item"
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            onClick={() => {
                              handleDeleteMessage(m._id);
                              setShowMsgOptions(null);
                            }}
                            style={{
                              padding: "0.6rem 1rem",
                              background: "none",
                              border: "none",
                              color: "var(--danger)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "0.85rem",
                            }}
                            className="message-action-item"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Box */}
      <div
        style={{
          height: "var(--bottom-bar-height)",
          flexShrink: 0,
          padding: "0 1.5rem",
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          position: "relative",
        }}
      >
        {forwardedMessage && (
          <div
            style={{
              position: "absolute",
              bottom: "var(--bottom-bar-height)",
              left: 0,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.4rem 1.5rem",
              background: "var(--bg-tertiary)",
              borderTop: "1px solid var(--border-color)",
              fontSize: "0.75rem",
              zIndex: 10,
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Forwarding: {forwardedMessage.content}
            </span>
            <X
              size={15}
              style={{ cursor: "pointer", flexShrink: 0 }}
              onClick={() => {
                setForwardedMessage(null);
                setNewMessage("");
              }}
            />
          </div>
        )}
        {replyTo && (
          <div
            style={{
              position: "absolute",
              bottom: "var(--bottom-bar-height)",
              left: 0,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.4rem 1.5rem",
              background: "var(--bg-tertiary)",
              borderTop: "1px solid var(--border-color)",
              fontSize: "0.75rem",
              zIndex: 10,
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Replying to {replyTo.sender?.name || "message"}: {replyTo.content}
            </span>
            <X
              size={15}
              style={{ cursor: "pointer", flexShrink: 0 }}
              onClick={() => setReplyTo(null)}
            />
          </div>
        )}
        {editingMessage && (
          <div
            style={{
              position: "absolute",
              bottom: "var(--bottom-bar-height)",
              left: 0,
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(59, 130, 246, 0.95)",
              padding: "0.5rem 1.5rem",
              backdropFilter: "blur(8px)",
              fontSize: "0.85rem",
              borderTop: "1px solid var(--border-color)",
              zIndex: 10,
            }}
          >
            <span>Editing message...</span>
            <X
              size={16}
              style={{ cursor: "pointer" }}
              onClick={() => {
                setEditingMessage(null);
                setEditContent("");
              }}
            />
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            width: "100%",
          }}
        >
          <input
            type="text"
            placeholder={
              editingMessage ? "Edit message..." : "Type a message..."
            }
            value={editingMessage ? editContent : newMessage}
            onChange={(e) =>
              editingMessage ? setEditContent(e.target.value) : typingHandler(e)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (editingMessage) handleEditMessage();
                else sendMessage(e);
              }
            }}
            style={{
              flex: 1,
              padding: "0.75rem 1.25rem",
              borderRadius: "24px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              outline: "none",
              fontSize: "0.95rem",
            }}
          />
          <button
            onClick={sendButtonClicked}
            style={{
              background: "var(--accent-primary)",
              color: "white",
              border: "none",
              width: "45px",
              height: "45px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "var(--transition)",
              flexShrink: 0,
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.transform = "scale(1.05)")
            }
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {editingMessage ? (
              <Check size={20} />
            ) : (
              <Send size={20} style={{ marginLeft: "2px" }} />
            )}
          </button>
        </div>
      </div>
      {infoMessage && (
        <div
          onClick={() => setInfoMessage(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            background: "rgba(2, 6, 23, 0.46)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(360px, 100%)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem 1.1rem",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <Info size={18} color="var(--accent-primary)" />
                <strong>Message info</strong>
              </div>
              <button
                onClick={() => setInfoMessage(null)}
                aria-label="Close message info"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  border: 0,
                  borderRadius: "50%",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <X size={17} />
              </button>
            </div>
            <div style={{ padding: "1rem 1.1rem" }}>
              <div
                style={{
                  padding: "0.7rem",
                  marginBottom: "1rem",
                  borderRadius: "8px",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  wordBreak: "break-word",
                  fontSize: "0.9rem",
                }}
              >
                {infoMessage.content || "Empty message"}
              </div>
              <div
                style={{ display: "grid", gap: "0.65rem", fontSize: "0.82rem" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>Sent</span>
                  <span style={{ color: "var(--success)" }}>
                    ✓ {formatMessageTime(infoMessage.createdAt) || "Sent"}
                  </span>
                </div>
                {isInfoMessageMine && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                      }}
                    >
                      <span style={{ color: "var(--text-secondary)" }}>
                        Delivered
                      </span>
                      <span
                        style={{
                          color: infoMessage.deliveredTo?.length
                            ? "var(--success)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {infoMessage.deliveredTo?.length
                          ? "✓ Delivered"
                          : "Pending"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                      }}
                    >
                      <span style={{ color: "var(--text-secondary)" }}>
                        Seen
                      </span>
                      <span
                        style={{
                          color: infoMessage.seenBy?.length
                            ? "var(--success)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {infoMessage.seenBy?.length ? "✓ Seen" : "Pending"}
                      </span>
                    </div>
                  </>
                )}
                {infoMessage.isEdited && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      Edited
                    </span>
                    <span>Yes</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
