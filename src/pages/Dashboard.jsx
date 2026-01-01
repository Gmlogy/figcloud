import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { motion } from "framer-motion";

import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { api } from "@/lib/api";
import { normalizePhoneNumber } from "@/utils/phoneUtils";

import ConversationList from "../components/messages/ConversationList";
import MessageThread from "../components/messages/MessageThread";
import StatsOverview from "../components/messages/StatsOverview";
import SecurityBanner from "../components/messages/SecurityBanner";
import NewConversationModal from "../components/messages/NewConversationModal";

/**
 * WebSocket URL (client connects via wss).
 * IMPORTANT: no trailing slash.
 */
const WS_URL = "wss://is2qkmtavd.execute-api.us-east-1.amazonaws.com/production";

function unwrapApi(resp) {
  // supports axios (resp.data) OR your api wrapper that returns data directly
  return resp?.data ?? resp;
}

function safeArray(resp) {
  const d = unwrapApi(resp);
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.Items)) return d.Items;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.data?.Items)) return d.data.Items;
  if (Array.isArray(d?.data?.items)) return d.data.items;
  return [];
}

function getNextCursor(resp) {
  const d = unwrapApi(resp);
  return (
    d?.nextCursor ||
    d?.next_cursor ||
    d?.cursor ||
    d?.next ||
    d?.LastEvaluatedKey ||
    d?.lastEvaluatedKey ||
    null
  );
}

/**
 * Robust timestamp -> epoch milliseconds.
 */
function toEpochMs(input) {
  if (input == null) return Date.now();

  if (typeof input === "number") {
    return input < 1e12 ? input * 1000 : input;
  }

  if (input instanceof Date) {
    const t = input.getTime();
    return Number.isFinite(t) ? t : Date.now();
  }

  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return Date.now();

    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return n < 1e12 ? n * 1000 : n;
    }

    const t = Date.parse(s);
    return Number.isFinite(t) ? t : Date.now();
  }

  return Date.now();
}

function toIsoFromMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  try {
    return new Date(ms).toISOString();
  } catch {
    return "";
  }
}

function safeStr(x) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

// A “good enough” fingerprint for same-message dedupe.
function messageFingerprint(m) {
  const msgType = safeStr(m?.messageType || m?.message_type).toUpperCase();
  const dir = msgType === "SENT" ? "S" : "R";

  const addr = normalizePhoneNumber(m?.address || m?.phone_number || "");
  const body = safeStr(m?.body ?? m?.message_content ?? m?.text ?? m?.raw?.body ?? "").trim();

  const atts = Array.isArray(m?.attachments) ? m.attachments : [];
  const attSig = atts
    .map((a) => safeStr(a?.s3Key || a?.s3_key || a?.key || a?.name || ""))
    .filter(Boolean)
    .slice(0, 3)
    .join(",");

  const tsMs = toEpochMs(m?.timestamp || m?.date);
  const bucket = Math.floor(tsMs / 5000); // 5s bucket

  return `${dir}|${addr}|${body}|${attSig}|${bucket}`;
}

function dedupeMessagesArray(arr) {
  const out = [];
  const seenIds = new Set();
  const seenFp = new Set();

  for (const m of Array.isArray(arr) ? arr : []) {
    const mid = m?.messageId || m?.id || null;
    if (mid) {
      const key = `id:${mid}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      out.push(m);
      continue;
    }

    const fp = `fp:${messageFingerprint(m)}`;
    if (seenFp.has(fp)) continue;
    seenFp.add(fp);
    out.push(m);
  }

  return out;
}

function normalizeThreadIdKey(threadId) {
  const s = String(threadId || "").trim();
  if (!s) return "";
  if (!s.includes("_")) return s;

  const parts = s
    .split("_")
    .map((p) => normalizePhoneNumber(p))
    .filter(Boolean)
    .sort();

  return parts.join("_");
}

function extractLastReadMap(readRows) {
  const map = {};

  const writeMax = (key, iso) => {
    if (!key || !iso) return;
    const incomingMs = toEpochMs(iso);
    const existingIso = map[key];
    const existingMs = existingIso ? toEpochMs(existingIso) : 0;
    if (!existingMs || incomingMs > existingMs) {
      map[key] = new Date(incomingMs).toISOString();
    }
  };

  for (const r of readRows || []) {
    const tidRaw = r.threadId ?? r.thread_id ?? r.threadKey ?? r.thread_key;
    if (tidRaw == null) continue;

    const rawKey = String(tidRaw);
    const normalizedKey = normalizeThreadIdKey(rawKey);

    const msRaw =
      r.lastReadAtMs ??
      r.last_read_at_ms ??
      r.lastReadMs ??
      r.last_read_ms ??
      null;

    if (msRaw != null) {
      const iso = toIsoFromMs(Number(msRaw));
      writeMax(rawKey, iso);
      writeMax(normalizedKey, iso);
      continue;
    }

    const isoRaw =
      r.lastReadAt ??
      r.last_read_at ??
      r.lastReadAtIso ??
      r.last_read_at_iso ??
      null;

    if (isoRaw) {
      const iso = new Date(toEpochMs(isoRaw)).toISOString();
      writeMax(rawKey, iso);
      writeMax(normalizedKey, iso);
    }
  }

  return map;
}

function extractIdToken(session) {
  const tokens = session?.tokens;
  const idToken = tokens?.idToken?.toString?.() || tokens?.idToken || session?.idToken || null;
  return typeof idToken === "string" ? idToken : null;
}

function mergeReadMaps(prev, incoming) {
  const out = { ...prev };

  for (const [rawKey, isoRaw] of Object.entries(incoming || {})) {
    const ms = toEpochMs(isoRaw);
    const iso = new Date(ms).toISOString();

    const k1 = String(rawKey);
    const k2 = normalizeThreadIdKey(rawKey);

    for (const k of [k1, k2]) {
      if (!k) continue;
      const existingIso = out[k];
      const existingMs = existingIso ? toEpochMs(existingIso) : 0;
      if (!existingMs || ms > existingMs) out[k] = iso;
    }
  }

  return out;
}

function resolveLastReadIso(threadReads, threadId, message) {
  const keys = [];

  const rawTid = threadId != null ? String(threadId) : "";
  if (rawTid) keys.push(rawTid);

  const normalizedTid = rawTid ? normalizeThreadIdKey(rawTid) : "";
  if (normalizedTid && normalizedTid !== rawTid) keys.push(normalizedTid);

  const msgThreadId =
    message?.threadId ??
    message?.thread_id ??
    message?.raw?.threadId ??
    message?.raw?.thread_id;

  if (msgThreadId != null) keys.push(String(msgThreadId));

  if (message?.address) keys.push(normalizePhoneNumber(message.address));
  if (message?.raw?.address) keys.push(normalizePhoneNumber(message.raw.address));

  for (const k of keys) {
    if (!k) continue;
    const iso = threadReads?.[k];
    if (iso) return iso;
  }
  return null;
}

function computeDisplayBody(message) {
  const raw = message || {};
  const atts = Array.isArray(raw.attachments) ? raw.attachments : [];

  const kind = String(raw.kind || "").toLowerCase();
  const isMms =
    kind === "mms" ||
    atts.length > 0 ||
    raw.msg_box != null ||
    raw.thread_id != null;

  const body =
    (typeof raw.body === "string" && raw.body) ||
    (typeof raw.message_content === "string" && raw.message_content) ||
    "";

  const text = (typeof raw.text === "string" && raw.text) || "";

  if (isMms) {
    const t = text.trim();
    if (t) return t;

    const b = body.trim();
    if (b && b !== "[MMS]") return b;

    // ✅ IMPORTANT: don’t force "[MMS]" as last_message text in thread list
    // return "" so the UI shows the thread but with blank preview if needed
    return b === "[MMS]" ? "" : b;
  }

  return body;
}

export default function DashboardPage() {
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [threadReads, setThreadReads] = useState({});

  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const [isNewConversationModalOpen, setIsNewConversationModalOpen] = useState(false);
  const [ephemeralConversations, setEphemeralConversations] = useState({});

  // ✅ new: progressive loading status
  const [messagesLoadInfo, setMessagesLoadInfo] = useState({ loading: false, loaded: 0, error: "" });

  // --- WS refs/state ---
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const isUnmountingRef = useRef(false);

  // Keep latest reads in a ref to debounce markThreadRead without dependency loops
  const threadReadsRef = useRef(threadReads);
  useEffect(() => {
    threadReadsRef.current = threadReads;
  }, [threadReads]);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    connectWs();

    return () => {
      isUnmountingRef.current = true;
      cleanupWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.phone_number]);

  const cleanupWs = () => {
    try {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    } catch {
      // ignore
    }
  };

  const scheduleReconnect = () => {
    if (isUnmountingRef.current) return;

    const attempt = Math.min(reconnectAttemptRef.current + 1, 8);
    reconnectAttemptRef.current = attempt;

    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 20000);
    console.log(`[WS] scheduling reconnect in ${delay}ms (attempt ${attempt})`);

    reconnectTimerRef.current = setTimeout(() => {
      connectWs();
    }, delay);
  };

  const connectWs = async () => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    console.log("[WS] connecting:", WS_URL);
    cleanupWs();

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = async () => {
      try {
        reconnectAttemptRef.current = 0;
        console.log("[WS] open -> sending auth");

        const session = await fetchAuthSession();
        const idToken = extractIdToken(session);

        if (!idToken) {
          console.warn("[WS] No idToken available, closing socket");
          ws.close(1008, "Missing token");
          return;
        }

        ws.send(JSON.stringify({ action: "auth", token: idToken }));
      } catch (e) {
        console.error("[WS] auth send failed:", e);
        ws.close(1011, "Auth failed");
      }
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);

        if (payload?.type === "MESSAGE_NEW" && payload?.message) {
          const m = payload.message;

          const normalized = {
            ...m,
            body: m.body ?? m.message_content ?? "",
            text: m.text ?? "",
            kind: m.kind ?? "",
            attachments: Array.isArray(m.attachments) ? m.attachments : [],
            address: m.address ?? "",
            timestamp: m.timestamp ?? new Date().toISOString(),
            messageType: (m.messageType || m.message_type || "RECEIVED")
              .toString()
              .toUpperCase(),
            messageId: m.messageId || m.id || null,
          };

          setMessages((prev) => {
            const mid = normalized.messageId || null;
            const fp = messageFingerprint(normalized);

            if (mid && prev.some((x) => (x.messageId || x.id) === mid)) return prev;
            if (prev.some((x) => messageFingerprint(x) === fp)) return prev;

            return [...prev, normalized];
          });

          const incoming = normalized.messageType !== "SENT";
          const threadId = normalized.threadId || payload.threadId;
          if (incoming && threadId && threadId === selectedThreadId) {
            markThreadRead(threadId, normalized.timestamp);
          }
        }

        if (payload?.type === "THREAD_READ" && payload?.threadId) {
          const rawTid = String(payload.threadId);
          const normalizedTid = normalizeThreadIdKey(rawTid);

          const applyRead = (iso) => {
            if (!iso) return;
            setThreadReads((prev) => ({
              ...prev,
              [rawTid]: iso,
              [normalizedTid]: iso,
            }));
          };

          if (payload.lastReadAtMs != null) {
            const ms = Number(payload.lastReadAtMs);
            const iso = toIsoFromMs(ms);
            applyRead(iso);
            return;
          }

          if (payload.lastReadAt) {
            const ms = toEpochMs(payload.lastReadAt);
            const iso = new Date(ms).toISOString();
            applyRead(iso);
          }
        }
      } catch (e) {
        console.warn("[WS] parse error:", e);
      }
    };

    ws.onerror = (e) => {
      console.warn("[WS] error:", e);
    };

    ws.onclose = (e) => {
      console.warn("[WS] closed:", e?.code, e?.reason || "");
      if (!isUnmountingRef.current) scheduleReconnect();
    };
  };

  // ✅ NEW: paged /messages fetch
  const fetchMessagesPaged = useCallback(async () => {
    const LIMIT = 200;
    const MAX_PAGES = 200;     // safety
    const MAX_ITEMS = 20000;   // safety (won’t hit for you)

    let cursor = null;
    let page = 0;
    let all = [];

    setMessagesLoadInfo({ loading: true, loaded: 0, error: "" });

    while (page < MAX_PAGES && all.length < MAX_ITEMS) {
      page += 1;

      let resp;
      try {
        resp = await api.get("/messages", {
          params: {
            limit: LIMIT,
            cursor: cursor || undefined,
          },
        });
      } catch (e) {
        // If your backend doesn't support pagination, break and fallback
        console.warn("[messages] page fetch failed, will fallback:", e);
        throw e;
      }

      const items = safeArray(resp);
      const next = getNextCursor(resp);

      if (items.length) {
        all = dedupeMessagesArray([...all, ...items]);
        setMessages(all); // ✅ show conversations as soon as possible
        setMessagesLoadInfo({ loading: true, loaded: all.length, error: "" });
      }

      if (!next || items.length === 0) {
        break;
      }

      cursor = typeof next === "string" ? next : JSON.stringify(next);
    }

    setMessagesLoadInfo({ loading: false, loaded: all.length, error: "" });
    return all;
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const current = await getCurrentUser();

      const phoneFromAttributes = current?.attributes?.phone_number;
      const phoneFromLoginId = current?.signInDetails?.loginId;

      const user = {
        phone_number: phoneFromAttributes || phoneFromLoginId || "",
      };
      setCurrentUser(user);

      // ---- contacts ----
      let contactsArray = [];
      try {
        const fetchedContacts = await api.get("/contacts");
        contactsArray = safeArray(fetchedContacts);
      } catch (err) {
        console.error("Error fetching /contacts:", err);
        contactsArray = [];
      }

      // ---- reads ----
      let readsArray = [];
      try {
        const fetchedReads = await api.get("/threads/read");
        readsArray = safeArray(fetchedReads);
      } catch (err) {
        console.error("Error fetching /threads/read:", err);
        readsArray = [];
      }

      setContacts(
        contactsArray.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
      );
      setThreadReads(extractLastReadMap(readsArray));

      // ---- messages (paged first, fallback to plain) ----
      try {
        await fetchMessagesPaged();
      } catch (err) {
        console.error("Error fetching /messages paged (fallback to plain):", err);
        setMessagesLoadInfo((prev) => ({
          ...prev,
          error: "Messages download failed (payload too large). Using fallback…",
        }));

        try {
          const fetchedMessages = await api.get("/messages");
          const messagesArray = safeArray(fetchedMessages);
          setMessages(dedupeMessagesArray(messagesArray));
          setMessagesLoadInfo({ loading: false, loaded: messagesArray.length, error: "" });
        } catch (e2) {
          console.error("Error fetching /messages fallback:", e2);
          setMessages([]);
          setMessagesLoadInfo({ loading: false, loaded: 0, error: "Messages failed to load." });
        }
      }
    } catch (error) {
      console.error("Error in loadInitialData wrapper:", error);
      setMessages([]);
      setContacts([]);
      setThreadReads({});
      setMessagesLoadInfo({ loading: false, loaded: 0, error: "Failed to load initial data." });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMessages = async () => {
    await loadInitialData();
    setEphemeralConversations({});
  };

  // Poll reads so web stays in sync even if WS never emits THREAD_READ
  const refreshThreadReads = useCallback(async () => {
    try {
      const fetchedReads = await api.get("/threads/read");
      const readsArray = safeArray(fetchedReads);
      const map = extractLastReadMap(readsArray);

      setThreadReads((prev) => mergeReadMaps(prev, map));
    } catch (e) {
      console.error("[reads] refreshThreadReads failed:", e);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const intervalId = setInterval(() => {
      refreshThreadReads();
    }, 3000);

    const onVis = () => {
      if (document.visibilityState === "visible") refreshThreadReads();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [currentUser?.phone_number, refreshThreadReads]);

  const markThreadRead = useCallback(async (threadId, lastMessageTimestamp) => {
    if (!threadId) return;

    const lastReadAtMs = toEpochMs(lastMessageTimestamp);

    const rawTid = String(threadId);
    const normalizedTid = normalizeThreadIdKey(rawTid);

    const existingIso =
      threadReadsRef.current?.[rawTid] || threadReadsRef.current?.[normalizedTid];
    const existingMs = existingIso ? toEpochMs(existingIso) : 0;
    if (existingMs && lastReadAtMs <= existingMs) return;

    const optimisticIso = new Date(lastReadAtMs).toISOString();
    setThreadReads((prev) => ({
      ...prev,
      [rawTid]: optimisticIso,
      [normalizedTid]: optimisticIso,
    }));

    try {
      await api.post("/threads/read", {
        threadId: rawTid,
        threadKey: normalizedTid,
        lastReadAtMs,
        origin: "web",
      });
    } catch (e) {
      console.error("markThreadRead failed:", e);
    }
  }, []);

  // ✅ IMMEDIATE WIN: build a fast lookup map once (instead of contacts.find per message)
  const contactsByPhone = useMemo(() => {
    const map = new Map();
    for (const c of Array.isArray(contacts) ? contacts : []) {
      const k = normalizePhoneNumber(c?.phone_number || "");
      if (k) map.set(k, c);
    }
    return map;
  }, [contacts]);

  // Build conversations from messages + contacts
  const conversations = useMemo(() => {
    if (!Array.isArray(messages) || !currentUser) return {};

    const myRawPhone = currentUser.phone_number || currentUser.phoneNumber || "";
    const normalizedMe = normalizePhoneNumber(myRawPhone);

    return messages.reduce((acc, message) => {
      const normalizedAddress = normalizePhoneNumber(message.address);

      if (!normalizedAddress && !normalizedMe) return acc;

      let threadId;
      if (normalizedMe) {
        const participants = [normalizedMe, normalizedAddress].filter(Boolean).sort();
        threadId = participants.join("_");
      } else {
        threadId = normalizedAddress || message.address || "unknown";
      }

      if (!acc[threadId]) {
        const contact = normalizedAddress ? contactsByPhone.get(normalizedAddress) : null;

        acc[threadId] = {
          thread_id: threadId,
          contact_name: contact?.full_name || message.address,
          phone_number: normalizedAddress || message.address,
          messages: [],
          last_message: null,
          unread_count: 0,
          is_group: message.is_group || false,
        };
      }

      const msgType = (message.messageType || "").toString().toUpperCase();
      const isSent = msgType === "SENT";
      const timestamp = message.timestamp || message.date || new Date().toISOString();

      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      const kind = message.kind || "";
      const text = message.text || "";
      const isMms = String(kind).toLowerCase() === "mms" || attachments.length > 0 || message.msg_box != null;

      const displayBody = computeDisplayBody(message);

      acc[threadId].messages.push({
        id: message.messageId || timestamp,
        messageId: message.messageId || message.id || null,
        message_content: displayBody,
        timestamp,
        is_sent: isSent,
        sync_status: "synced",

        is_mms: isMms,
        kind,
        text,
        attachments,

        raw: message,
      });

      // UNREAD LOGIC
      const msgMs = toEpochMs(timestamp);
      const isIncoming = !isSent;

      const readFlag =
        typeof message.read === "boolean"
          ? message.read
          : typeof message.is_read === "boolean"
          ? message.is_read
          : null;

      const lastReadAtIso = resolveLastReadIso(threadReads, threadId, message);
      const lastReadMs = lastReadAtIso ? toEpochMs(lastReadAtIso) : 0;

      let isUnread = false;
      if (readFlag === true) {
        isUnread = false;
      } else {
        isUnread = isIncoming && msgMs > lastReadMs;
      }

      if (isUnread) acc[threadId].unread_count += 1;

      const existingLast = acc[threadId].last_message;
      const existingMs = existingLast ? toEpochMs(existingLast.timestamp) : 0;

      if (!existingLast || msgMs > existingMs) {
        acc[threadId].last_message = {
          ...message,
          message_content: displayBody,
          is_sent: isSent,
          timestamp,
        };
      }

      return acc;
    }, {});
  }, [messages, contactsByPhone, currentUser, threadReads]);

  const allConversations = useMemo(() => {
    const merged = { ...conversations, ...ephemeralConversations };
    Object.values(merged).forEach((conv) => {
      conv.display_name = conv.contact_name || conv.phone_number;
      if (conv.messages) {
        conv.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      }
    });
    return merged;
  }, [conversations, ephemeralConversations]);

  const conversationList = useMemo(() => {
    return Object.values(allConversations)
      .sort((a, b) => {
        const dateA = a.last_message ? new Date(a.last_message.timestamp) : new Date(0);
        const dateB = b.last_message ? new Date(b.last_message.timestamp) : new Date(0);
        return dateB - dateA;
      })
      .filter((conv) => {
        switch (activeFilter) {
          case "unread":
            if (conv.unread_count === 0) return false;
            break;
          case "groups":
            if (!conv.is_group) return false;
            break;
          case "all":
          default:
            break;
        }

        if (searchQuery) {
          return conv.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      });
  }, [allConversations, activeFilter, searchQuery]);

  const handleStartConversation = (recipient) => {
    if (!currentUser || !recipient.phone_number) return;

    const participants = [
      currentUser.phone_number || currentUser.phoneNumber,
      recipient.phone_number,
    ]
      .filter(Boolean)
      .sort();

    const newThreadId = participants.join("_");

    if (!allConversations[newThreadId]) {
      const newPlaceholder = {
        thread_id: newThreadId,
        contact_name: recipient.contact_name,
        phone_number: recipient.phone_number,
        display_name: recipient.contact_name || recipient.phone_number,
        messages: [],
        is_group: false,
        last_message: null,
        unread_count: 0,
      };

      setEphemeralConversations((prev) => ({
        ...prev,
        [newThreadId]: newPlaceholder,
      }));
    }

    setSelectedThreadId(newThreadId);
    setIsNewConversationModalOpen(false);

    const lastTs = allConversations[newThreadId]?.last_message?.timestamp;
    markThreadRead(newThreadId, lastTs || new Date().toISOString());
  };

  const handleSelectThread = (threadId) => {
    setSelectedThreadId(threadId);

    const conv = allConversations[threadId];
    const lastTs = conv?.last_message?.timestamp;

    markThreadRead(threadId, lastTs || new Date().toISOString());
  };

  const selectedConversation = selectedThreadId ? allConversations[selectedThreadId] : null;

  return (
    <>
      <NewConversationModal
        isOpen={isNewConversationModalOpen}
        onClose={() => setIsNewConversationModalOpen(false)}
        contacts={contacts}
        onSelectRecipient={handleStartConversation}
      />

      <div className="h-screen flex bg-slate-50">
        <div className="w-80 border-r flex flex-col bg-white border-slate-200">
          <div className="p-6 border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-medium text-slate-900">Messages</h1>
              <Button
                size="icon"
                variant="ghost"
                className="w-10 h-10 rounded-full hover:bg-slate-100"
                onClick={() => setIsNewConversationModalOpen(true)}
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-full border-slate-200 h-12 bg-slate-50 focus:bg-white"
              />
            </div>

            {/* ✅ show message loading info */}
            {(messagesLoadInfo.loading || messagesLoadInfo.error) && (
              <div className="mt-3 text-xs text-slate-500">
                {messagesLoadInfo.loading ? (
                  <div>Loading messages… ({messagesLoadInfo.loaded} loaded)</div>
                ) : null}
                {messagesLoadInfo.error ? (
                  <div className="text-amber-600">{messagesLoadInfo.error}</div>
                ) : null}
              </div>
            )}
          </div>

          <SecurityBanner currentUser={currentUser} />

          <StatsOverview
            messages={messages}
            conversations={Object.values(allConversations)}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            currentUser={currentUser}
          />

          <div className="flex-1 overflow-y-auto bg-white">
            <ConversationList
              conversations={conversationList}
              selectedThread={selectedThreadId}
              onSelectThread={handleSelectThread}
              isLoading={isLoading}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <MessageThread
              conversation={selectedConversation}
              currentUser={currentUser}
              onRefresh={refreshMessages}
              onMarkRead={(threadId) => {
                const lastTs = selectedConversation?.last_message?.timestamp;
                markThreadRead(threadId, lastTs || new Date().toISOString());
              }}
              onMessageSent={(serverItem) => {
                if (!serverItem) return;
                setMessages((prev) => {
                  const mid = serverItem.messageId || serverItem.id || null;
                  const candidate = { ...serverItem, messageId: mid };

                  if (mid && prev.some((x) => (x.messageId || x.id) === mid)) return prev;

                  const fp = messageFingerprint(candidate);
                  if (prev.some((x) => messageFingerprint(x) === fp)) return prev;

                  return [...prev, candidate];
                });
              }}
              onLoadOlder={null}
              hasMore={false}
              isLoadingThread={false}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center bg-blue-100">
                  <Search className="w-12 h-12 text-blue-600" />
                </div>
                <h2 className="text-2xl font-medium mb-2 text-slate-900">
                  Select a Conversation
                </h2>
                <p className="max-w-sm text-slate-600">
                  Choose a conversation from the list to view your synced messages
                </p>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
