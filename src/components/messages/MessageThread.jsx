import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  Phone,
  Video,
  MoreVertical,
  Send,
  Check,
  Clock,
  Wifi,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
} from "lucide-react";

function digitsOnly(x) {
  return String(x || "").replace(/\D/g, "");
}

function canonicalPhoneKey(raw) {
  let d = digitsOnly(raw);
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);

  // Morocco
  if (d.length === 12 && d.startsWith("212")) return d.slice(-9);
  if (d.length === 10 && d.startsWith("0")) return d.slice(1);

  // US
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);

  if (d.length > 10) return d.slice(-10);
  return d;
}

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

function formatMessageTime(timestamp) {
  if (!timestamp) return "";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return format(date, "'Yesterday' h:mm a");
  return format(date, "MMM d, h:mm a");
}

function getInitials(name, phone) {
  if (name && name !== phone) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return phone ? phone.slice(-2) : "??";
}

function normalizeAttachments(message) {
  const atts = Array.isArray(message?.attachments)
    ? message.attachments
    : Array.isArray(message?.raw?.attachments)
    ? message.raw.attachments
    : [];
  return atts.filter(Boolean);
}

function isMmsMessage(message) {
  if (!message) return false;
  if (message.is_mms === true) return true;
  const kind = String(message.kind || message.raw?.kind || "").toLowerCase();
  const atts = normalizeAttachments(message);
  return kind === "mms" || atts.length > 0;
}

function getMime(att) {
  return (
    att?.mimeType ||
    att?.mime_type ||
    att?.contentType ||
    att?.content_type ||
    att?.type ||
    ""
  );
}

function getFileName(att, idx) {
  return (
    att?.fileName ||
    att?.file_name ||
    att?.name ||
    att?.filename ||
    `Attachment ${idx + 1}`
  );
}

function getS3Key(att) {
  return att?.s3Key || att?.s3_key || "";
}

function isImageMime(mime) {
  return typeof mime === "string" && mime.toLowerCase().startsWith("image/");
}

function getDisplayTextWithoutMmsPlaceholder(message) {
  const m = message || {};
  const raw = m.raw || {};
  const mms = isMmsMessage(m);

  const text =
    (typeof m.text === "string" && m.text) ||
    (typeof raw.text === "string" && raw.text) ||
    "";

  const body =
    (typeof m.message_content === "string" && m.message_content) ||
    (typeof raw.body === "string" && raw.body) ||
    (typeof raw.message_content === "string" && raw.message_content) ||
    "";

  if (!mms) return body || "";

  const t = String(text || "").trim();
  if (t) return t;

  return "";
}

function AttachmentList({ message, isSent }) {
  const atts = normalizeAttachments(message);

  const [resolved, setResolved] = useState({});
  const inFlightRef = useRef(new Set());

  const resetKey = useMemo(
    () => `${message?.messageId || message?.id || ""}|${message?.timestamp || ""}`,
    [message?.messageId, message?.id, message?.timestamp]
  );

  useEffect(() => {
    setResolved({});
    inFlightRef.current = new Set();
  }, [resetKey]);

  const fetchDownloadUrl = useCallback(
    async (key) => {
      if (!key) return null;
      if (resolved[key]?.url) return resolved[key].url;

      if (inFlightRef.current.has(key)) return null;
      inFlightRef.current.add(key);

      try {
        const resp = await api.get(`/mms/download-url?key=${encodeURIComponent(key)}`);
        const url =
          resp?.url ||
          resp?.data?.url ||
          resp?.data?.URL ||
          resp?.URL ||
          null;

        if (url) {
          setResolved((prev) => ({
            ...prev,
            [key]: {
              url,
              ts: Date.now(),
              failedOnce: prev[key]?.failedOnce || false,
            },
          }));
        }
        return url;
      } catch (e) {
        console.error("fetchDownloadUrl failed:", e);
        return null;
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [resolved]
  );

  useEffect(() => {
    if (!atts.length) return;
    const keys = atts.map(getS3Key).filter(Boolean);
    keys.forEach((k) => {
      if (!resolved[k]?.url) fetchDownloadUrl(k);
    });
  }, [atts, fetchDownloadUrl, resolved]);

  const openAttachment = async (att) => {
    const key = getS3Key(att);
    if (!key) return;

    const url = resolved[key]?.url || (await fetchDownloadUrl(key));
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleImgError = async (att) => {
    const key = getS3Key(att);
    if (!key) return;
    if (resolved[key]?.failedOnce) return;

    setResolved((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), failedOnce: true },
    }));

    await fetchDownloadUrl(key);
  };

  if (!atts.length) return null;

  return (
    <div className={`mt-2 space-y-2 ${isSent ? "text-green-50" : "text-slate-700"}`}>
      {atts.map((a, idx) => {
        const mime = getMime(a);
        const name = getFileName(a, idx);
        const key = getS3Key(a);

        const url = key ? resolved[key]?.url : null;
        const canOpen = !!(key && url);
        const isImg = isImageMime(mime);

        return (
          <div
            key={`${name}-${idx}`}
            className={`rounded-lg px-3 py-2 border ${
              isSent ? "border-white/25 bg-white/10" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <Paperclip className="w-3 h-3 shrink-0" />
                  <span className="font-medium truncate">{name}</span>
                  {mime ? (
                    <span className={`${isSent ? "text-green-100" : "text-slate-500"} shrink-0`}>
                      ({mime})
                    </span>
                  ) : null}
                </div>

                <div className={`text-[11px] mt-1 ${isSent ? "text-green-100" : "text-slate-500"}`}>
                  {key ? (url ? "Ready" : "Loading…") : "No key — waiting for upload"}
                </div>
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={`h-8 w-8 rounded-full ${
                  isSent ? "hover:bg-white/10" : "hover:bg-slate-100"
                }`}
                disabled={!canOpen}
                onClick={() => openAttachment(a)}
                title={canOpen ? "Open" : "Loading"}
              >
                {isImg ? <ImageIcon className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
              </Button>
            </div>

            {isImg ? (
              <div className="mt-3">
                {url ? (
                  <img
                    src={url}
                    alt={name}
                    className="max-h-64 w-auto rounded-md border border-slate-200"
                    loading="lazy"
                    style={{ cursor: "pointer" }}
                    onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                    onError={() => handleImgError(a)}
                  />
                ) : (
                  <div
                    className={`text-xs rounded-md px-3 py-2 ${
                      isSent ? "bg-white/10 text-green-100" : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    Loading image…
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function MessageThread({
  conversation,
  currentUser,
  onRefresh,
  onMarkRead,
  onMessageSent,

  onLoadOlder = null,
  hasMore = false,
  isLoadingThread = false,
}) {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [localMessages, setLocalMessages] = useState([]);
  const messagesEndRef = useRef(null);

  if (!conversation || !currentUser) return null;

  const otherNumber = useMemo(
    () => String(conversation?.phone_number || conversation?.phoneNumber || ""),
    [conversation?.phone_number, conversation?.phoneNumber]
  );

  const fingerprintLocal = useCallback(
    (m) => {
      const dir = m?.is_sent ? "S" : "R";
      const body = String(m?.message_content ?? m?.text ?? m?.raw?.body ?? "").trim();

      const atts = Array.isArray(m?.attachments) ? m.attachments : [];
      const attSig = atts
        .map((a) => String(a?.s3Key || a?.s3_key || a?.key || a?.name || ""))
        .filter(Boolean)
        .slice(0, 3)
        .join(",");

      const ts = m?.timestamp || Date.now();
      const tsMs = new Date(ts).getTime();
      const bucket = Math.floor((Number.isFinite(tsMs) ? tsMs : Date.now()) / 10_000);

      return `${dir}|${otherNumber}|${body}|${attSig}|${bucket}`;
    },
    [otherNumber]
  );

  const dedupeLocalMessages = useCallback(
    (arr) => {
      const out = [];
      const seen = new Set();

      for (const m of Array.isArray(arr) ? arr : []) {
        const mid = m?.messageId || m?.id || null;

        if (mid) {
          const k = `id:${mid}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push(m);
          continue;
        }

        const k = `fp:${fingerprintLocal(m)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(m);
      }

      return out;
    },
    [fingerprintLocal]
  );

  /**
   * ✅ IMPORTANT: threadId must match Dashboard logic
   * or you’ll re-introduce duplicates when sending.
   */
  const getCanonicalThreadId = () => {
    const meRaw = currentUser?.phone_number || currentUser?.phoneNumber || "";
    const otherRaw = conversation?.phone_number || conversation?.phoneNumber || "";

    const meKey = canonicalPhoneKey(meRaw) || digitsOnly(meRaw) || String(meRaw || "");
    const otherKey = canonicalPhoneKey(otherRaw) || digitsOnly(otherRaw) || String(otherRaw || "");

    if (meKey && otherKey) {
      const [a, b] = [meKey, otherKey].sort();
      return `${a}_${b}`;
    }
    return conversation.thread_id;
  };

  useEffect(() => {
    const server = Array.isArray(conversation?.messages) ? conversation.messages : [];
    const sortedServer = [...server].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

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

      return dedupeLocalMessages(merged);
    });
  }, [conversation?.messages, dedupeLocalMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages.length]);

  useEffect(() => {
    if (!onMarkRead) return;
    const tid = conversation?.thread_id;
    if (!tid) return;
    onMarkRead(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.thread_id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || isSending) return;

    const threadId = conversation?.thread_id; // ✅ always send to the currently-open thread

    const nowIso = new Date().toISOString();

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      messageId: null,
      message_content: trimmed,
      is_sent: true,
      timestamp: nowIso,
      sync_status: "pending",
      is_mms: false,
      attachments: [],
    };

    setIsSending(true);
    setLocalMessages((prev) => dedupeLocalMessages([...prev, optimistic]));
    setNewMessage("");

    try {
      await api.post("/messages", {
  threadId,
  body: trimmed,
  to: conversation?.phone_number || conversation?.phoneNumber || "", // backend can ignore if not needed
});

      setLocalMessages((prev) =>
        dedupeLocalMessages(
          prev.map((m) => (m.id === tempId ? { ...m, sync_status: "synced" } : m))
        )
      );

      onMessageSent &&
  onMessageSent({
    threadId,
    address: conversation?.phone_number || conversation?.phoneNumber || "",
    messageType: "SENT",
    body: trimmed,
    timestamp: nowIso,
    attachments: [],
    kind: "",
  });
    } catch (error) {
      console.error("Failed to send message:", error);
      setLocalMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, sync_status: "error" } : m))
      );
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
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
            <span className="text-sm font-medium text-green-800">Fig Phone Connected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              Real-time Sync
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {(hasMore || isLoadingThread) && (
          <div className="flex justify-center py-2">
            {isLoadingThread ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading…</span>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => onLoadOlder && onLoadOlder()}
                disabled={!onLoadOlder}
                title={!onLoadOlder ? "Pagination not enabled yet" : "Load older messages"}
              >
                Load older messages
              </Button>
            )}
          </div>
        )}

        <AnimatePresence>
          {localMessages.map((message, index) => {
            const isSent = !!message.is_sent;
            const mms = isMmsMessage(message);
            const displayText = getDisplayTextWithoutMmsPlaceholder(message);

            return (
              <motion.div
                key={message.messageId || message.id || `${message.timestamp}-${index}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${isSent ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    isSent
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                      : "bg-slate-100 text-slate-900 border border-slate-200"
                  }`}
                >
                  {displayText ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {displayText}
                    </p>
                  ) : null}

                  {mms ? <AttachmentList message={message} isSent={isSent} /> : null}

                  <div
                    className={`flex items-center justify-end gap-1 mt-2 text-xs ${
                      isSent ? "text-green-100" : "text-slate-500"
                    }`}
                  >
                    <span>{formatMessageTime(message.timestamp)}</span>
                    <MessageStatusIcon message={message} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <div ref={messagesEndRef} />

        {localMessages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No messages in this conversation</p>
          </div>
        )}
      </div>

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
