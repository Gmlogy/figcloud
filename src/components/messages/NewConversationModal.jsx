// src/components/messages/NewConversationModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, PlusCircle } from "lucide-react";

export default function NewConversationModal({ isOpen, onClose, contacts, onSelectRecipient }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Reset search term when the modal is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  };

  const filteredResults = useMemo(() => {
    if (!searchTerm) {
      return contacts; // Show all contacts initially
    }

    const lowercasedFilter = searchTerm.toLowerCase();
    const results = contacts.filter(contact =>
      contact.full_name?.toLowerCase().includes(lowercasedFilter) ||
      contact.phone_number?.includes(lowercasedFilter)
    );

    // Check if the search term is a plausible phone number and not already in the results
    const isPhoneNumber = /^\+?[0-9\s-()]{7,}$/.test(searchTerm);
    const existingNumber = contacts.some(c => c.phone_number === searchTerm);

    if (isPhoneNumber && !existingNumber) {
      results.push({
        isNew: true,
        full_name: searchTerm,
        phone_number: searchTerm,
      });
    }

    return results;
  }, [searchTerm, contacts]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Type a name or phone number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <ScrollArea className="h-[300px] border rounded-md">
            <div className="p-2">
              {filteredResults.length > 0 ? (
                filteredResults.map((item, index) => (
                  <div
                    key={item.isNew ? 'new' : item.contactId || index}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                    onClick={() => onSelectRecipient({ 
                        contact_name: item.full_name, 
                        phone_number: item.phone_number 
                    })}
                  >
                    <Avatar>
                      <AvatarFallback>
                        {item.isNew ? <PlusCircle className="w-5 h-5" /> : getInitials(item.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{item.full_name}</p>
                      {!item.isNew && <p className="text-sm text-muted-foreground">{item.phone_number}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No contacts found.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}