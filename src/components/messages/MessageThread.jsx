import React, { useState, useEffect, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from '@/lib/api';
import { Phone, Video, MoreVertical, Send, Check, Clock, Wifi } from "lucide-react";

const MessageStatusIcon = ({ message }) => {
  if (!message.is_sent) return null;
  switch (message.sync_status) {
    case 'pending': return <Clock className="w-3 h-3 ml-1" />;
    case 'synced': return <Check className="w-3 h-3 ml-1" />;
    default: return null;
  }
};

export default function MessageThread({ conversation, currentUser, onRefresh }) {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages]);

  if (!conversation || !currentUser) return null;

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setIsSending(true);

    try {
      // --- THIS IS THE FIX ---
      // We no longer generate a new threadId. We use the one that
      // already exists on the conversation object. This guarantees the
      // reply is added to the correct conversation.
      const payload = {
        threadId: conversation.thread_id,
        body: newMessage.trim(),
      };
      // --- END OF FIX ---
      
      await api.post('/messages', payload);
      setNewMessage(""); 
      setTimeout(() => onRefresh(), 2500);
      
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return format(date, "'Yesterday' h:mm a");
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  const getInitials = (name, phone) => {
    if (name && name !== phone) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return phone ? phone.slice(-2) : '??';
  };

  const sortedMessages = [...conversation.messages].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

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
        <AnimatePresence>
          {sortedMessages.map((message, index) => (
            <motion.div
              key={message.id || index}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.is_sent ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                message.is_sent
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-900 border border-slate-200'
              }`}>
                <p className="text-sm leading-relaxed">{message.message_content}</p>
                <div className={`flex items-center justify-end gap-1 mt-2 text-xs ${
                  message.is_sent ? 'text-green-100' : 'text-slate-500'
                }`}>
                  <span>{formatMessageTime(message.timestamp)}</span>
                  <MessageStatusIcon message={message} />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
        
        {sortedMessages.length === 0 && (
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