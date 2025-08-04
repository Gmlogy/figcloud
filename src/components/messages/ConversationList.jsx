import React from "react";
import { format, isToday, isYesterday } from "date-fns";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Smartphone, Users } from "lucide-react";

export default function ConversationList({ 
  conversations, 
  selectedThread, 
  onSelectThread, 
  isLoading 
}) {
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };

  const getInitials = (name, phone) => {
    if (name && name !== phone) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return phone ? phone.slice(-2) : '??';
  };

  const getGroupInitials = (groupName) => {
    return groupName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {conversations.map((conversation, index) => (
        <motion.div
          key={conversation.thread_id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`p-4 cursor-pointer transition-all duration-200 hover:bg-slate-50 ${
            selectedThread === conversation.thread_id 
              ? 'bg-blue-50 border-r-2 border-blue-500' 
              : ''
          }`}
          onClick={() => onSelectThread(conversation.thread_id)}
        >
          <div className="flex items-start gap-3">
            <div className="relative">
              <Avatar className={`w-12 h-12 ${conversation.is_group ? 'ring-2 ring-green-200' : ''}`}>
                <AvatarFallback className={`${
                  conversation.is_group 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                    : 'bg-gradient-to-br from-blue-500 to-purple-600'
                } text-white font-semibold`}>
                  {conversation.is_group ? (
                    getGroupInitials(conversation.group_name)
                  ) : (
                    getInitials(conversation.contact_name, conversation.phone_number)
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                <Smartphone className="w-2 h-2 text-white" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-900 truncate flex items-center gap-2">
                  {conversation.display_name}
                  {conversation.is_group && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      <Users className="w-3 h-3 mr-1" />
                      Group
                    </Badge>
                  )}
                </h3>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {conversation.last_message && formatMessageTime(conversation.last_message.timestamp)}
                </span>
              </div>
              
              {conversation.is_group && (
                <p className="text-xs text-slate-500 truncate mb-1">
                  {conversation.display_subtitle}
                </p>
              )}
              
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 truncate">
                  {conversation.last_message?.is_sent ? (
                    <span className="text-blue-600 mr-1">You: </span>
                  ) : conversation.is_group ? (
                    <span className="text-purple-600 mr-1">{conversation.last_message?.contact_name}: </span>
                  ) : null}
                  {conversation.last_message?.message_content || 'No messages'}
                </p>
                
                {conversation.unread_count > 0 && (
                  <Badge variant="default" className="ml-2 bg-blue-600 text-white rounded-full px-2 py-1 text-xs">
                    {conversation.unread_count}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <MessageCircle className="w-3 h-3" />
                  <span>{conversation.messages.length} messages</span>
                </div>
                {conversation.is_group && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Users className="w-3 h-3" />
                    <span>{conversation.participant_count} members</span>
                  </div>
                )}
                {!conversation.is_group && conversation.phone_number !== conversation.contact_name && (
                  <span className="text-xs text-slate-400">{conversation.phone_number}</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
      
      {conversations.length === 0 && !isLoading && (
        <div className="p-8 text-center">
          <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No conversations found</p>
          <p className="text-sm text-slate-400 mt-1">Messages will appear here once synced</p>
        </div>
      )}
    </div>
  );
}