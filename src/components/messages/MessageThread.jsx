import React, { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
<<<<<<< HEAD
import {
  Phone,
  Video,
  MoreVertical,
  Send,
  Check,
  Clock,
  Wifi,
} from "lucide-react";
=======
import { Phone, Video, MoreVertical, Send, Check, Clock, Wifi } from "lucide-react";
>>>>>>> c72b082 (A concise description of the edit/feature)

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

function stableMessageKey(m) {
  // Highest priority: server messageId (unique)
  if (m?.messageId) return `mid:${m.messageId}`;

  // If you store the raw DynamoDB item on the message, use it:
  // (Dashboard builds conv.messages with `raw: message`)
  const raw = m?.raw || {};
  if (raw?.messageId) return `mid:${raw.messageId}`;

  // If a client-side temp id exists
  if (m?.id && String(m.id).startsWith("temp-")) return `tmp:${m.id}`;

  // Fallback fingerprint (not perfect, but avoids key collisions most of the time)
  const ts = m?.timestamp || "";
  const body = m?.message_content || "";
  const dir = m?.is_sent ? "S" : "R";
  return `fb:${dir}|${ts}|${body}`;
}

function dedupeAndSort(messages) {
  const map = new Map();

  for (const m of messages) {
    const key = stableMessageKey(m);
    const prev = map.get(key);

    // Prefer the "best" copy:
    // - prefer synced over pending/error
    // - prefer one that has messageId
    if (!prev) {
      map.set(key, m);
      continue;
    }

    const prevHasId = !!(prev?.messageId || prev?.raw?.messageId);
    const curHasId = !!(m?.messageId || m?.raw?.messageId);

    const prevSynced = prev?.sync_status === "synced";
    const curSynced = m?.sync_status === "synced";

    if (curHasId && !prevHasId) {
      map.set(key, m);
    } else if (curSynced && !prevSynced) {
      map.set(key, m);
    } else if (curHasId === prevHasId && curSynced === prevSynced) {
      // If both similar, keep the one with later timestamp (if any)
      const pt = new Date(prev?.timestamp || 0).getTime();
      const ct = new Date(m?.timestamp || 0).getTime();
      if (ct > pt) map.set(key, m);
    }
  }

  const out = Array.from(map.values());
  out.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return out;
}

export default function MessageThread({
  conversation,
  currentUser,
  onRefresh,      // optional fallback
  onMarkRead,     // optional
  onMessageSent,  // optional hook from Dashboard
}) {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [localMessages, setLocalMessages] = useState([]);
  const messagesEndRef = useRef(null);

  if (!conversation || !currentUser) return null;

<<<<<<< HEAD
  // Build a canonical threadId from the two phone numbers.
  // This guarantees it matches what SendMessageFunction expects.
=======
>>>>>>> c72b082 (A concise description of the edit/feature)
  const getCanonicalThreadId = () => {
    const me = currentUser?.phone_number || currentUser?.phoneNumber;
    const other = conversation.phone_number;

    if (me && other) {
<<<<<<< HEAD
      // stable order so both sides compute the same string
      const [a, b] = [me, other].sort();
      return `${a}_${b}`;
    }

    // fallback to whatever is already stored
    return conversation.thread_id;
  };

  useEffect(() => {
    // keep local messages in sync with server, sorted ascending by time
    if (conversation?.messages) {
      const sorted = [...conversation.messages].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      setLocalMessages(sorted);
    }
  }, [conversation.messages]);
=======
      const [a, b] = [me, other].sort();
      return `${a}_${b}`;
    }
    return conversation.thread_id;
  };

  // Keep local list in sync with conversation.messages, but dedupe aggressively
  useEffect(() => {
    const server = Array.isArray(conversation?.messages) ? conversation.messages : [];
    const merged = dedupeAndSort(server);
    setLocalMessages((prev) => {
      // Preserve pending/error messages that are not yet represented server-side
      const pendings = prev.filter((m) => m?.sync_status === "pending" || m?.sync_status === "error");
      const combined = dedupeAndSort([...merged, ...pendings]);
      return combined;
    });
  }, [conversation?.messages]);
>>>>>>> c72b082 (A concise description of the edit/feature)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages.length]);

<<<<<<< HEAD
=======
  useEffect(() => {
    if (!conversation || !currentUser || !onMarkRead) return;
    onMarkRead(getCanonicalThreadId());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.thread_id, currentUser?.phone_number, onMarkRead]);

>>>>>>> c72b082 (A concise description of the edit/feature)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || isSending) return;

    const threadId = getCanonicalThreadId();
    const nowIso = new Date().toISOString();

<<<<<<< HEAD
    // Optimistic UI message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
=======
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      messageId: null,
>>>>>>> c72b082 (A concise description of the edit/feature)
      message_content: trimmed,
      is_sent: true,
      timestamp: nowIso,
      sync_status: "pending",
    };

    setIsSending(true);
<<<<<<< HEAD
    setLocalMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");

    try {
      await api.post("/messages", {
        threadId,
        body: trimmed,
      });

      // Optionally flip local optimistic message to "synced"
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, sync_status: "synced" } : m
        )
      );

      // Refresh from backend so we see the real saved item
      setTimeout(() => {
        onRefresh && onRefresh();
      }, 1200);
    } catch (error) {
      console.error("Failed to send message:", error);

      // Mark the optimistic bubble as failed (optional)
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, sync_status: "error" }
            : m
        )
      );

=======
    setNewMessage("");
    setLocalMessages((prev) => dedupeAndSort([...prev, optimistic]));

    try {
      const resp = await api.post("/messages", { threadId, body: trimmed });
      const serverItem = resp?.data ? resp.data : resp;

      // If server returns messageId, use it and update parent immediately
      if (serverItem?.messageId) {
        onMessageSent && onMessageSent(serverItem);

        setLocalMessages((prev) => {
          // Remove the optimistic temp message (same body/timestamp may not match exactly)
          const withoutTemp = prev.filter((m) => m?.id !== tempId);
          // Add a "synced" representation that matches the UI shape
          const syncedUi = {
            id: serverItem.messageId,
            messageId: serverItem.messageId,
            message_content: serverItem.body ?? trimmed,
            is_sent: true,
            timestamp: serverItem.timestamp ?? nowIso,
            sync_status: "synced",
            raw: serverItem,
          };
          return dedupeAndSort([...withoutTemp, syncedUi]);
        });
      } else {
        // If response is not as expected, just mark optimistic as synced and optionally refresh once
        setLocalMessages((prev) =>
          prev.map((m) => (m?.id === tempId ? { ...m, sync_status: "synced" } : m))
        );
        onRefresh && onRefresh();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setLocalMessages((prev) =>
        prev.map((m) => (m?.id === tempId ? { ...m, sync_status: "error" } : m))
      );
>>>>>>> c72b082 (A concise description of the edit/feature)
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (timestamp) => {
<<<<<<< HEAD
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return format(date, "Yesterday h:mm a");
    } else {
      return format(date, "MMM d, h:mm a");
    }
=======
    if (!timestamp) return "";
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";

    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return format(date, "'Yesterday' h:mm a");
    return format(date, "MMM d, h:mm a");
>>>>>>> c72b082 (A concise description of the edit/feature)
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

<<<<<<< HEAD
=======
  // Precompute keys once per render (stable, avoids repeated key computation)
  const keyedMessages = useMemo(() => {
    return localMessages.map((m, idx) => ({
      m,
      k: stableMessageKey(m) + `|i:${idx}`, // ensures uniqueness even in rare collision
    }));
  }, [localMessages]);

>>>>>>> c72b082 (A concise description of the edit/feature)
  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="border-b p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                {getInitials(
                  conversation.contact_name,
                  conversation.phone_number
                )}
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
<<<<<<< HEAD
          {localMessages.map((message, index) => (
            <motion.div
              key={message.id || `${message.timestamp}-${index}`}
=======
          {keyedMessages.map(({ m: message, k }) => (
            <motion.div
              key={k}
>>>>>>> c72b082 (A concise description of the edit/feature)
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
<<<<<<< HEAD
              className={`flex ${
                message.is_sent ? "justify-end" : "justify-start"
              }`}
=======
              className={`flex ${message.is_sent ? "justify-end" : "justify-start"}`}
>>>>>>> c72b082 (A concise description of the edit/feature)
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  message.is_sent
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                    : "bg-slate-100 text-slate-900 border border-slate-200"
                }`}
              >
<<<<<<< HEAD
                <p className="text-sm leading-relaxed">
                  {message.message_content}
                </p>
=======
                <p className="text-sm leading-relaxed">{message.message_content}</p>
>>>>>>> c72b082 (A concise description of the edit/feature)
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
