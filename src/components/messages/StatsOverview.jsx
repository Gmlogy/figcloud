import React from "react";
import { MessageSquare, MessageCircleMore, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StatsOverview({
  messages,
  conversations,
  activeFilter,
  onFilterChange,
  currentUser,
}) {
  const totalCount = Array.isArray(conversations) ? conversations.length : 0;
  const unreadCount = conversations.filter(conv => conv.unread_count > 0).length;
  const groupCount = conversations.filter(conv => conv.is_group).length;

  return (
    <div className="px-4 py-3 border-b bg-white border-slate-200">
      <div className="mb-3">
        <Tabs
          value={activeFilter}
          // Make sure we always pass the tab value string directly into onFilterChange
          onValueChange={(value) => onFilterChange(value)}
        >
          <TabsList className="grid w-full grid-cols-3 h-12 p-1 rounded-full bg-slate-100">
            {/* ALL */}
            <TabsTrigger 
              value="all" 
              className="flex items-center justify-center gap-2 text-sm font-medium rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              <span>All</span>
              {totalCount > 0 && (
                <span className="ml-1 text-xs bg-slate-200 text-slate-800 rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center font-medium">
                  {totalCount}
                </span>
              )}
            </TabsTrigger>

            {/* UNREAD */}
            <TabsTrigger 
              value="unread"
              className="flex items-center justify-center gap-2 text-sm font-medium rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <MessageCircleMore className="w-4 h-4" />
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center font-medium">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>

            {/* GROUPS */}
            <TabsTrigger 
              value="groups"
              className="flex items-center justify-center gap-2 text-sm font-medium rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Users className="w-4 h-4" />
              <span>Groups</span>
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
