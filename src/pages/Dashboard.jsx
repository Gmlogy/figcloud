import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { motion } from "framer-motion";
<<<<<<< HEAD
import { getCurrentUser } from "aws-amplify/auth";
=======

import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
>>>>>>> c72b082 (A concise description of the edit/feature)
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

function safeArray(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.Items)) return resp.Items;
  if (Array.isArray(resp?.data)) return resp.data;
  if (Array.isArray(resp?.data?.Items)) return resp.data.Items;
  return [];
}

function extractLastReadMap(readRows) {
  // Accepts [{threadId,lastReadAt}] or {Items:[...]} from safeArray
  const map = {};
  for (const r of readRows) {
    const tid = r.threadId || r.thread_id;
    const t = r.lastReadAt || r.last_read_at;
    if (tid && t) map[tid] = t;
  }
  return map;
}

function extractIdToken(session) {
  // Amplify v6 fetchAuthSession returns tokens in different shapes depending on config.
  // We try the common ones.
  const tokens = session?.tokens;
  const idToken =
    tokens?.idToken?.toString?.() ||
    tokens?.idToken ||
    session?.idToken ||
    null;

  return typeof idToken === "string" ? idToken : null;
}

export default function DashboardPage() {
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [threadReads, setThreadReads] = useState({}); // { [threadId]: lastReadAtISO }

  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
<<<<<<< HEAD
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] =
    useState(false);
=======

  const [isNewConversationModalOpen, setIsNewConversationModalOpen] = useState(false);
>>>>>>> c72b082 (A concise description of the edit/feature)
  const [ephemeralConversations, setEphemeralConversations] = useState({});

  // --- WS refs/state ---
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const isUnmountingRef = useRef(false);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // connect WS once we know we have a user (or at least are logged in)
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

    // backoff: 1s, 2s, 4s ... max ~20s
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 20000);

    console.log(`[WS] scheduling reconnect in ${delay}ms (attempt ${attempt})`);
    reconnectTimerRef.current = setTimeout(() => {
      connectWs();
    }, delay);
  };

  const connectWs = async () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
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

        // route selection expression is $request.body.action
        ws.send(JSON.stringify({ action: "auth", token: idToken }));
      } catch (e) {
        console.error("[WS] auth send failed:", e);
        ws.close(1011, "Auth failed");
      }
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        // console.log("[WS] message:", payload);

        if (payload?.type === "MESSAGE_NEW" && payload?.message) {
          const m = payload.message;

          // Normalize to the same shape as /messages returns
          const normalized = {
            ...m,
            body: m.body ?? m.message_content ?? "",
            address: m.address ?? "",
            timestamp: m.timestamp ?? new Date().toISOString(),
            messageType: (m.messageType || m.message_type || "RECEIVED").toString().toUpperCase(),
            messageId: m.messageId || m.id || null,
          };

          // Update messages state (dedupe by messageId if present)
          setMessages((prev) => {
            if (normalized.messageId && prev.some((x) => x.messageId === normalized.messageId)) {
              return prev;
            }
            return [...prev, normalized];
          });

          // If user is currently viewing this thread, mark as read immediately
          const incoming = normalized.messageType !== "SENT";
          const threadId = normalized.threadId || payload.threadId;
          if (incoming && threadId && threadId === selectedThreadId) {
            markThreadRead(threadId, normalized.timestamp);
          }
        }

        if (payload?.type === "THREAD_READ" && payload?.threadId && payload?.lastReadAt) {
          setThreadReads((prev) => ({
            ...prev,
            [payload.threadId]: payload.lastReadAt,
          }));
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

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Current user
<<<<<<< HEAD
      const { signInDetails } = await getCurrentUser();
      const user = {
        phone_number: signInDetails.loginId,
      };
=======
      const current = await getCurrentUser();

      // This is how your existing code was doing it:
      const phoneFromAttributes = current?.attributes?.phone_number;
      const phoneFromLoginId = current?.signInDetails?.loginId;

      const user = { phone_number: phoneFromAttributes || phoneFromLoginId || "" };
>>>>>>> c72b082 (A concise description of the edit/feature)
      setCurrentUser(user);

      // Fetch messages
      let messagesArray = [];
      try {
        const fetchedMessages = await api.get("/messages");
<<<<<<< HEAD
        messagesArray = Array.isArray(fetchedMessages)
          ? fetchedMessages
          : fetchedMessages.Items || [];
=======
        messagesArray = safeArray(fetchedMessages);
>>>>>>> c72b082 (A concise description of the edit/feature)
      } catch (err) {
        console.error("Error fetching /messages:", err);
        messagesArray = [];
      }

<<<<<<< HEAD
      // Fetch contacts independently (can fail with 500)
      let contactsArray = [];
      try {
        const fetchedContacts = await api.get("/contacts");
        contactsArray = Array.isArray(fetchedContacts)
          ? fetchedContacts
          : fetchedContacts.Items || [];
=======
      // Fetch contacts
      let contactsArray = [];
      try {
        const fetchedContacts = await api.get("/contacts");
        contactsArray = safeArray(fetchedContacts);
>>>>>>> c72b082 (A concise description of the edit/feature)
      } catch (err) {
        console.error("Error fetching /contacts:", err);
        contactsArray = [];
      }
<<<<<<< HEAD
=======

      // Fetch thread read cursors (new)
      let readsArray = [];
      try {
        const fetchedReads = await api.get("/threads/read");
        readsArray = safeArray(fetchedReads);
      } catch (err) {
        console.error("Error fetching /threads/read:", err);
        readsArray = [];
      }
>>>>>>> c72b082 (A concise description of the edit/feature)

      setMessages(messagesArray);
      setContacts(
        contactsArray.sort((a, b) =>
          (a.full_name || "").localeCompare(b.full_name || "")
        )
      );
<<<<<<< HEAD
=======
      setThreadReads(extractLastReadMap(readsArray));
>>>>>>> c72b082 (A concise description of the edit/feature)
    } catch (error) {
      console.error("Error in loadInitialData wrapper:", error);
      setMessages([]);
      setContacts([]);
      setThreadReads({});
    } finally {
      setIsLoading(false);
    }
  };

<<<<<<< HEAD
  const conversations = Array.isArray(messages)
    ? messages.reduce((acc, message) => {
        if (!currentUser || !currentUser.phone_number) return acc;

        const normalizedCurrentUserPhone = normalizePhoneNumber(
          currentUser.phone_number
        );
        const normalizedAddress = normalizePhoneNumber(message.address);

        if (!normalizedCurrentUserPhone || !normalizedAddress) return acc;

        // Build consistent thread id
        const participants = [normalizedCurrentUserPhone, normalizedAddress].sort();
        const threadId = participants.join("_");

        if (!acc[threadId]) {
          const contact = contacts.find(
            (c) => normalizePhoneNumber(c.phone_number) === normalizedAddress
          );

          acc[threadId] = {
            thread_id: threadId,
            contact_name: contact?.full_name || message.address,
            phone_number: normalizedAddress,
            messages: [],
            last_message: null,
            unread_count: 0,
            is_group: message.is_group || false,
          };
        }

        const msgType = (message.messageType || "").toString().toUpperCase();
        const isSent = msgType === "SENT";
        const isIncoming = !isSent;

        const timestamp =
          message.timestamp || message.date || new Date().toISOString();

        acc[threadId].messages.push({
          id: timestamp,
          message_content: message.body,
          timestamp,
          is_sent: isSent,
          sync_status: "synced",
        });

        // ------ UNREAD LOGIC (treat missing read field as unread) ------
        const hasReadField =
          Object.prototype.hasOwnProperty.call(message, "read") &&
          typeof message.read === "boolean";

        // Unread if:
        //  - incoming AND
        //  - (no read field at all OR read === false)
        const isUnread =
  message.read === false ||      // proper boolean false
  message.read === 0 ||          // legacy int
  message.read === "0";          // just in case

if (isUnread && message.messageType !== "SENT") {
  acc[threadId].unread_count += 1;
}

        // ---------------------------------------------------------------

        const existingLast = acc[threadId].last_message;
        const existingTs = existingLast
          ? new Date(existingLast.timestamp)
          : new Date(0);

        if (!existingLast || new Date(timestamp) > existingTs) {
          acc[threadId].last_message = {
            ...message,
            message_content: message.body,
            is_sent: isSent,
            timestamp,
          };
        }

        return acc;
      }, {})
    : {};
=======
  const refreshMessages = async () => {
    await loadInitialData();
    setEphemeralConversations({});
  };

  const markThreadRead = useCallback(
    async (threadId, lastMessageTimestamp) => {
      if (!threadId) return;

      // Optimistic local update first (keeps UI snappy)
      const optimistic = lastMessageTimestamp || new Date().toISOString();
      setThreadReads((prev) => ({ ...prev, [threadId]: optimistic }));

      try {
        const resp = await api.post("/threads/read", {
          threadId,
          lastMessageTimestamp: optimistic,
        });

        const lastReadAt =
          resp?.lastReadAt ||
          resp?.data?.lastReadAt ||
          optimistic;

        setThreadReads((prev) => ({ ...prev, [threadId]: lastReadAt }));
      } catch (e) {
        console.error("markThreadRead failed:", e);
      }
    },
    []
  );

  // Build conversations from messages + contacts
  const conversations = useMemo(() => {
    if (!Array.isArray(messages) || !currentUser) return {};

    return messages.reduce((acc, message) => {
      const myRawPhone = currentUser.phone_number || currentUser.phoneNumber || "";
      const normalizedMe = normalizePhoneNumber(myRawPhone);
      const normalizedAddress = normalizePhoneNumber(message.address);

      if (!normalizedAddress && !normalizedMe) return acc;

      // Thread id logic (same as your current logic)
      let threadId;
      if (normalizedMe) {
        const participants = [normalizedMe, normalizedAddress].filter(Boolean).sort();
        threadId = participants.join("_");
      } else {
        threadId = normalizedAddress || message.address || "unknown";
      }

      if (!acc[threadId]) {
        const contact = contacts.find(
          (c) => normalizePhoneNumber(c.phone_number) === normalizedAddress
        );

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

      // Keep a copy of raw server message for dedupe/keys if needed
      acc[threadId].messages.push({
        id: message.messageId || timestamp,
        messageId: message.messageId || message.id || null,
        message_content: message.body,
        timestamp,
        is_sent: isSent,
        sync_status: "synced",
        raw: message,
      });

      // --- UNREAD LOGIC using per-thread read cursor ---
      const lastReadAt = threadReads[threadId];
      const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
      const msgTime = new Date(timestamp).getTime();
>>>>>>> c72b082 (A concise description of the edit/feature)

      const isIncoming = !isSent;
      const isUnreadByCursor = isIncoming && msgTime > lastReadTime;

<<<<<<< HEAD
  Object.values(allConversations).forEach((conv) => {
    conv.display_name = conv.contact_name || conv.phone_number;
    if (conv.messages) {
      conv.messages.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
    }
  });

  const conversationList = Object.values(allConversations)
    .sort((a, b) => {
      const dateA = a.last_message
        ? new Date(a.last_message.timestamp)
        : new Date(0);
      const dateB = b.last_message
        ? new Date(b.last_message.timestamp)
        : new Date(0);
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
        return conv.display_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());
      }

      return true;
    });

  const refreshMessages = async () => {
    await loadInitialData();
    setEphemeralConversations({});
  };
=======
      if (isUnreadByCursor) acc[threadId].unread_count += 1;
      // -----------------------------------------------

      const existingLast = acc[threadId].last_message;
      const existingTs = existingLast ? new Date(existingLast.timestamp) : new Date(0);

      if (!existingLast || new Date(timestamp) > existingTs) {
        acc[threadId].last_message = {
          ...message,
          message_content: message.body,
          is_sent: isSent,
          timestamp,
        };
      }

      return acc;
    }, {});
  }, [messages, contacts, currentUser, threadReads]);

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
>>>>>>> c72b082 (A concise description of the edit/feature)

  const handleStartConversation = (recipient) => {
    if (!currentUser || !recipient.phone_number) return;

<<<<<<< HEAD
    const participants = [currentUser.phone_number, recipient.phone_number].sort();
=======
    const participants = [
      currentUser.phone_number || currentUser.phoneNumber,
      recipient.phone_number,
    ].filter(Boolean).sort();

>>>>>>> c72b082 (A concise description of the edit/feature)
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

    // Mark as read when opening
    const lastTs = allConversations[newThreadId]?.last_message?.timestamp;
    markThreadRead(newThreadId, lastTs || new Date().toISOString());
  };

<<<<<<< HEAD
  const selectedConversation = selectedThreadId
    ? allConversations[selectedThreadId]
    : null;
=======
  const handleSelectThread = (threadId) => {
    setSelectedThreadId(threadId);

    const conv = allConversations[threadId];
    const lastTs = conv?.last_message?.timestamp;

    // Mark read on open
    markThreadRead(threadId, lastTs || new Date().toISOString());
  };

  const selectedConversation = selectedThreadId ? allConversations[selectedThreadId] : null;
>>>>>>> c72b082 (A concise description of the edit/feature)

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
          </div>

          <SecurityBanner currentUser={currentUser} />
<<<<<<< HEAD
=======

>>>>>>> c72b082 (A concise description of the edit/feature)
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
<<<<<<< HEAD
=======
              onMarkRead={(threadId) => {
                const lastTs = selectedConversation?.last_message?.timestamp;
                markThreadRead(threadId, lastTs || new Date().toISOString());
              }}
              // optional hook if your MessageThread uses it
              onMessageSent={(serverItem) => {
                if (!serverItem) return;
                setMessages((prev) => {
                  const mid = serverItem.messageId || serverItem.id;
                  if (mid && prev.some((x) => x.messageId === mid)) return prev;
                  return [...prev, { ...serverItem, messageId: mid }];
                });
              }}
>>>>>>> c72b082 (A concise description of the edit/feature)
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
<<<<<<< HEAD
=======

>>>>>>> c72b082 (A concise description of the edit/feature)
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg max-w-md mx-auto">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-green-800">
<<<<<<< HEAD
                      Fig Phone Connected
                    </span>
                  </div>
                  <p className="text-xs text-green-600">
                    Real-time sync active • Keep your Fig Phone powered on and
                    connected.
=======
                      Real-time connected
                    </span>
                  </div>
                  <p className="text-xs text-green-600">
                    Messages update instantly • Keep your phone connected.
>>>>>>> c72b082 (A concise description of the edit/feature)
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
