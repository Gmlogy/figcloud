import React, { useState, useEffect, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Phone, Video, MoreVertical, Send, Check, Clock, Wifi } from "lucide-react";

const MessageStatusIcon = ({ message }) => {
  if (!message.is_sent) return null;

  switch (message.sync_status) {
    case "pending":
      return <Clock className="w-3 h-3 ml-1" />;
    case "synced":
      return <Check className="w-3 h-3 ml-1" />;
    default:
      return null;
  }
};

export default function MessageThread({
  conversation,
  currentUser,
  onRefresh,      // optional fallback
  onMarkRead,     // optional
  onMessageSent,  // NEW: parent state update hook
}) {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [localMessages, setLocalMessages] = useState([]);
  const messagesEndRef = useRef(null);

  if (!conversation || !currentUser) return null;

  const getCanonicalThreadId = () => {
    const me = currentUser?.phone_number || currentUser?.phoneNumber;
    const other = conversation.phone_number;

    if (me && other) {
      const [a, b] = [me, other].sort();
      return `${a}_${b}`;
    }
    return conversation.thread_id;
  };

  // Merge server messages into local view
  useEffect(() => {
    const server = Array.isArray(conversation?.messages) ? conversation.messages : [];
    const sortedServer = [...server].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Keep any local pending/error messages that are not in server list
    setLocalMessages((prev) => {
      const serverIds = new Set(
        sortedServer.map((m) => m.messageId || m.id || `${m.timestamp}|${m.message_content}`)
      );

      const keepLocal = prev.filter((m) => {
        if (m.sync_status !== "pending" && m.sync_status !== "error") return false;
        const key = m.messageId || m.id || `${m.timestamp}|${m.message_content}`;
        return !serverIds.has(key);
      });

      const merged = [...sortedServer, ...keepLocal].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      return merged;
    });
  }, [conversation.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages.length]);

  useEffect(() => {
    if (!conversation || !currentUser || !onMarkRead) return;
    const threadId = getCanonicalThreadId();
    onMarkRead(threadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.thread_id, currentUser?.phone_number, onMarkRead]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || isSending) return;

    const threadId = getCanonicalThreadId();
    const nowIso = new Date().toISOString();

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      messageId: null,
      message_content: trimmed,
      is_sent: true,
      timestamp: nowIso,
      sync_status: "pending",
    };

    setIsSending(true);
    setLocalMessages((prev) => [...prev, optimistic]);
    setNewMessage("");

    try {
      // IMPORTANT: expect server returns messageItem with messageId, timestamp, threadId...
      const resp = await api.post("/messages", { threadId, body: trimmed });

      const serverItem = resp && typeof resp === "object" ? resp : null;

      if (serverItem?.messageId) {
        // update parent immediately (Dashboard state)
        onMessageSent && onMessageSent(serverItem);

        // replace optimistic entry with a synced local entry
        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: serverItem.messageId,
                  messageId: serverItem.messageId,
                  timestamp: serverItem.timestamp || m.timestamp,
                  sync_status: "synced",
                }
              : m
          )
        );
      } else {
        // If your api wrapper returns { data: ... } style, try fallback:
        const maybe = serverItem?.data;
        if (maybe?.messageId) {
          onMessageSent && onMessageSent(maybe);
          setLocalMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: maybe.messageId,
                    messageId: maybe.messageId,
                    timestamp: maybe.timestamp || m.timestamp,
                    sync_status: "synced",
                  }
                : m
            )
          );
        } else {
          // last resort: mark optimistic synced and optionally refresh once
          setLocalMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, sync_status: "synced" } : m))
          );
          onRefresh && onRefresh(); // fallback only
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, sync_status: "error" } : m
        )
      );
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (Number.isNaN(date.getTime())) return "";

    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return format(date, "'Yesterday' h:mm a");
    } else {
      return format(date, "MMM d, h:mm a");
    }
  };

  const getInitials = (name, phone) => {
    if (name && name !== phone) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return phone ? phone.slice(-2) : "??";
  };

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="border-b p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                {getInitials(conversation.contact_name, conversation.phone_number)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                {conversation.display_name}
              </h2>
              <div className="text-sm text-slate-500">
                <span>{conversation.phone_number}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="hover:bg-slate-100">
              <Phone className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="hover:bg-slate-100">
              <Video className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="hover:bg-slate-100">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              Fig Phone Connected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <Badge
              variant="outline"
              className="text-xs bg-green-50 text-green-700 border-green-200"
            >
              Real-time Sync
            </Badge>
          </div>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        <AnimatePresence>
          {localMessages.map((message, index) => (
            <motion.div
              key={message.messageId || message.id || `${message.timestamp}-${index}`}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.is_sent ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  message.is_sent
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                    : "bg-slate-100 text-slate-900 border border-slate-200"
                }`}
              >
                <p className="text-sm leading-relaxed">
                  {message.message_content}
                </p>
                <div
                  className={`flex items-center justify-end gap-1 mt-2 text-xs ${
                    message.is_sent ? "text-green-100" : "text-slate-500"
                  }`}
                >
                  <span>{formatMessageTime(message.timestamp)}</span>
                  <MessageStatusIcon message={message} />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={messagesEndRef} />

        {localMessages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No messages in this conversation</p>
          </div>
        )}
      </div>

      {/* INPUT */}
      <div className="border-t p-4 bg-white">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Text Message"
            className="flex-1 rounded-full h-12 px-5 border-2 focus:bg-white border-green-100 focus:border-green-500"
            disabled={isSending}
          />
          <Button
            type="submit"
            size="icon"
            className="w-12 h-12 rounded-full transition-colors bg-green-600 hover:bg-green-700 disabled:bg-green-400"
            disabled={!newMessage.trim() || isSending}
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
