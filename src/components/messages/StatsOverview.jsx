import React from "react";
import { MessageSquare, MessageCircleMore, Users, Camera } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function StatsOverview({ messages, conversations, activeFilter, onFilterChange, currentUser }) {
  const unreadCount = conversations.filter(conv => conv.unread_count > 0).length;
  const groupCount = conversations.filter(conv => conv.is_group).length;

  return (
    <div className="px-4 py-3 border-b bg-white border-slate-200">
      <div className="mb-3">
        <Tabs value={activeFilter} onValueChange={onFilterChange}>
          <TabsList className="grid w-full grid-cols-3 h-12 p-1 rounded-full bg-slate-100">
            <TabsTrigger 
              value="all" 
              className="flex items-center gap-2 text-sm font-medium rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              All
            </TabsTrigger>
            <TabsTrigger 
              value="unread"
              className="flex items-center gap-2 text-sm font-medium rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <MessageCircleMore className="w-4 h-4" />
              Unread
              {unreadCount > 0 && (
                <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center font-medium">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="groups"
              className="flex items-center gap-2 text-sm font-medium rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Users className="w-4 h-4" />
              Groups
              {groupCount > 0 && (
                <span className="ml-1 text-xs bg-blue-500 text-white rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center font-medium">
                  {groupCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {currentUser && (
        <div className="text-xs text-center text-slate-500">
          Data for {currentUser.phone_number}
        </div>
      )}
    </div>
  );
}