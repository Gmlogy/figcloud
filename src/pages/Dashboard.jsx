
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Filter } from "lucide-react";
import { motion } from "framer-motion";

import ConversationList from "../components/messages/ConversationList";
import MessageThread from "../components/messages/MessageThread";
import StatsOverview from "../components/messages/StatsOverview";
import SecurityBanner from "../components/messages/SecurityBanner";
import PhoneVerificationModal from "../components/auth/PhoneVerificationModal";
import FirstSyncProgress from "../components/sync/FirstSyncProgress";

export default function DashboardPage() {
  const [messages, setMessages] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [showSyncProgress, setShowSyncProgress] = useState(false);

  useEffect(() => {
   // loadUserAndMessages();
  }, []);

  

  const loadMessages = async (userPhone) => {
    try {
      const data = await Message.filter({ created_by: userPhone }, "-timestamp", 100);
      setMessages(data);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleVerificationComplete = (phoneNumber) => {
    setShowPhoneVerification(false);
    setShowSyncProgress(true);
  };

  const handleSyncComplete = () => {
    setShowSyncProgress(false);
    // Reload everything after sync
    loadUserAndMessages();
  };

  // Show verification modal if needed
  /* --- Login page commented out for preview ---
  if (showPhoneVerification) {
    return <PhoneVerificationModal onVerificationComplete={handleVerificationComplete} />;
  }
  */

  // Show sync progress if needed
  if (showSyncProgress) {
    return <FirstSyncProgress phoneNumber={currentUser?.phone_number} onSyncComplete={handleSyncComplete} />;
  }

  // Group messages by thread_id
  const conversations = messages.reduce((acc, message) => {
    if (!acc[message.thread_id]) {
      acc[message.thread_id] = {
        thread_id: message.thread_id,
        contact_name: message.contact_name,
        group_name: message.group_name,
        phone_number: message.phone_number,
        messages: [],
        last_message: null,
        unread_count: 0,
        is_group: !!message.group_name,
        participants: new Map(),
        participant_phones: new Set()
      };
    }
    acc[message.thread_id].messages.push(message);
    
    acc[message.thread_id].participants.set(message.phone_number, message.contact_name);
    acc[message.thread_id].participant_phones.add(message.phone_number);
    
    if (!message.is_sent && message.sync_status === 'pending') {
      acc[message.thread_id].unread_count++;
    }
    
    if (!acc[message.thread_id].last_message || 
        new Date(message.timestamp) > new Date(acc[message.thread_id].last_message.timestamp)) {
      acc[message.thread_id].last_message = message;
    }
    
    return acc;
  }, {});

  Object.values(conversations).forEach(conv => {
    conv.participant_count = conv.participant_phones.size;
    
    if (conv.is_group && conv.group_name) {
      conv.display_name = conv.group_name;
      conv.display_subtitle = Array.from(conv.participants.values()).join(', ');
    } else {
      conv.display_name = conv.contact_name || conv.phone_number;
      conv.display_subtitle = conv.phone_number;
    }
  });

  const conversationList = Object.values(conversations)
    .sort((a, b) => new Date(b.last_message?.timestamp) - new Date(a.last_message?.timestamp))
    .filter(conv => {
      if (searchQuery) {
        const matchesSearch = conv.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               conv.display_subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               conv.last_message?.message_content?.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
      }
      
      switch (activeFilter) {
        case 'unread':
          return conv.unread_count > 0;
        case 'groups':
          return conv.is_group;
        case 'all':
        default:
          return true;
      }
    });

  const refreshMessages = async () => {
    if (currentUser) {
      await loadMessages(currentUser.phone_number);
    }
  };

  return (
    <div className="h-screen flex bg-slate-50">
      <div className="w-80 border-r flex flex-col bg-white border-slate-200">
        <div className="p-6 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-medium text-slate-900">Messages</h1>
            <Button 
              size="icon" 
              variant="ghost" 
              className="w-10 h-10 rounded-full hover:bg-slate-100"
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
          conversations={conversationList}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          currentUser={currentUser}
        />

        <div className="flex-1 overflow-y-auto bg-white">
          <ConversationList
            conversations={conversationList}
            selectedThread={selectedThread}
            onSelectThread={setSelectedThread}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <MessageThread
            conversation={conversations[selectedThread]}
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
              
              {/* Fig Phone Connection Status */}
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg max-w-md mx-auto">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-green-800">Fig Phone Connected</span>
                </div>
                <p className="text-xs text-green-600">
                  Real-time sync active • Keep your Fig Phone powered on and connected to mobile data
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
