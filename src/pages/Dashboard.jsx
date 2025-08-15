import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { getCurrentUser } from 'aws-amplify/auth';
import { api } from '@/lib/api';

import ConversationList from "../components/messages/ConversationList";
import MessageThread from "../components/messages/MessageThread";
import StatsOverview from "../components/messages/StatsOverview";
import SecurityBanner from "../components/messages/SecurityBanner";
import NewConversationModal from "../components/messages/NewConversationModal";

export default function DashboardPage() {
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] = useState(false);
  const [ephemeralConversations, setEphemeralConversations] = useState({});

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { signInDetails } = await getCurrentUser();
      const user = { 
        phone_number: signInDetails.loginId 
      };
      setCurrentUser(user);

      const [fetchedMessages, fetchedContacts] = await Promise.all([
        api.get('/messages'),
        api.get('/contacts')
      ]);

      const messagesArray = Array.isArray(fetchedMessages) ? fetchedMessages : fetchedMessages.Items || [];
      const contactsArray = Array.isArray(fetchedContacts) ? fetchedContacts : fetchedContacts.Items || [];

      setMessages(messagesArray);
      setContacts(contactsArray.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));

    } catch (error) {
      console.error("Error loading initial data:", error);
      setMessages([]); 
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const conversations = Array.isArray(messages) ? messages.reduce((acc, message) => {
    const threadId = message.threadId;
    if (!acc[threadId]) {
      acc[threadId] = {
        thread_id: threadId,
        contact_name: message.contactName || message.address, 
        phone_number: message.address,
        messages: [],
        last_message: null,
        unread_count: 0,
        is_group: message.is_group || false,
      };
    }
    acc[threadId].messages.push({
        id: message.timestamp,
        message_content: message.body,
        timestamp: message.timestamp,
        is_sent: message.messageType === 'SENT',
        sync_status: 'synced',
    });

    if (!message.read && message.messageType !== 'SENT') {
        acc[threadId].unread_count += 1;
    }
    if (!acc[threadId].last_message || new Date(message.timestamp) > new Date(acc[threadId].last_message.timestamp)) {
      acc[threadId].last_message = {
        ...message,
        message_content: message.body,
        is_sent: message.messageType === 'SENT',
      };
    }
    return acc;
  }, {}) : {};

  const allConversations = { ...conversations, ...ephemeralConversations };

  Object.values(allConversations).forEach(conv => {
      conv.display_name = conv.contact_name || conv.phone_number;
      if (conv.messages) {
          conv.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      }
  });

  const conversationList = Object.values(allConversations)
    .sort((a, b) => {
        const dateA = a.last_message ? new Date(a.last_message.timestamp) : new Date(0);
        const dateB = b.last_message ? new Date(b.last_message.timestamp) : new Date(0);
        return dateB - dateA;
    })
    .filter(conv => {
        switch (activeFilter) {
            case 'unread':
                if (conv.unread_count === 0) return false;
                break;
            case 'groups':
                if (!conv.is_group) return false;
                break;
            case 'all':
            default:
                break;
        }

        if (searchQuery) {
            return conv.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
        }

        return true;
    });

  const refreshMessages = async () => {
      await loadInitialData();
      setEphemeralConversations({});
  };

  const handleStartConversation = (recipient) => {
    if (!currentUser || !recipient.phone_number) return;

    const participants = [currentUser.phone_number, recipient.phone_number].sort();
    const newThreadId = participants.join('_');

    if (!allConversations[newThreadId]) {
      const newPlaceholder = {
        thread_id: newThreadId,
        contact_name: recipient.contact_name,
        phone_number: recipient.phone_number,
        display_name: recipient.contact_name || recipient.phone_number,
        messages: [],
        is_group: false,
        last_message: null,
      };
      
      setEphemeralConversations(prev => ({
        ...prev,
        [newThreadId]: newPlaceholder,
      }));
    }
    
    setSelectedThreadId(newThreadId);
    setIsNewConversationModalOpen(false);
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
              onSelectThread={setSelectedThreadId}
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
                    <h2 className="text-2xl font-medium mb-2 text-slate-900">Select a Conversation</h2>
                    <p className="max-w-sm text-slate-600">
                        Choose a conversation from the list to view your synced messages
                    </p>
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg max-w-md mx-auto">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-green-800">Fig Phone Connected</span>
                        </div>
                        <p className="text-xs text-green-600">
                            Real-time sync active • Keep your Fig Phone powered on and connected.
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