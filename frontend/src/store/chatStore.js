import { create } from "zustand";

const useChatStore = create((set) => ({
  selectedChat: null,
  chats: [],
  unreadCounts: {},
  messages: [],
  notifications: [],

  showSettings: false,
  setShowSettings: (val) => set({ showSettings: val }),
  activeTab: "account",
  setActiveTab: (tab) => set({ activeTab: tab }),

  socket: null,
  setSocket: (socket) => set({ socket }),

  showGroupModal: false,
  setShowGroupModal: (val) => set({ showGroupModal: val }),

  showGroupSettings: false,
  setShowGroupSettings: (val) => set({ showGroupSettings: val }),

  // Call states
  call: {
    isReceivingCall: false,
    from: null,
    name: null,
    avatar: null,
    signal: null,
    type: "video",
  },
  callAccepted: false,
  callEnded: false,
  stream: null,
  setCall: (call) => set({ call }),
  setCallAccepted: (val) => set({ callAccepted: val }),
  setCallEnded: (val) => set({ callEnded: val }),
  setStream: (stream) => set({ stream }),

  setSelectedChat: (chat) =>
    set((state) => ({
      selectedChat: chat,
      showSettings: false,
      unreadCounts: chat?._id
        ? { ...state.unreadCounts, [chat._id]: 0 }
        : state.unreadCounts,
    })),

  setChats: (chats) => set({ chats }),

  setUnreadCounts: (unreadCounts) => set({ unreadCounts }),

  incrementUnreadCount: (chatId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [chatId]: (state.unreadCounts[chatId] || 0) + 1,
      },
    })),

  updateChatLatestMessage: (message) =>
    set((state) => {
      const chatId = message?.chat?._id || message?.chat;
      if (!chatId) return state;

      const chatExists = state.chats.some((chat) => chat._id === chatId);
      if (!chatExists) return state;

      return {
        chats: state.chats.map((chat) =>
          chat._id === chatId ? { ...chat, latestMessage: message } : chat,
        ),
      };
    }),

  setMessages: (messages) =>
    set((state) => ({
      messages:
        typeof messages === "function" ? messages(state.messages) : messages,
    })),

  addMessage: (message) =>
    set((state) => {
      if (!message?._id) return { messages: [...state.messages, message] };
      const exists = state.messages.some((m) => m._id === message._id);
      if (exists) {
        return {
          messages: state.messages.map((m) =>
            m._id === message._id ? { ...m, ...message } : m,
          ),
        };
      }
      return {
        messages: [...state.messages, message],
      };
    }),

  setNotifications: (notifications) => set({ notifications }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),
}));

export default useChatStore;
