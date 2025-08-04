import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Phone, Mail, Building, RefreshCw, Users, Smartphone, MoreVertical, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

import ContactsActionsToolbar from "../components/contacts/ContactsActionsToolbar";

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
   // loadUserAndContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchQuery]);

 

  const filterContacts = () => {
    let filtered = contacts;
    
    if (searchQuery) {
      filtered = contacts.filter(contact =>
        contact.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone_number?.includes(searchQuery) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    const grouped = filtered.reduce((acc, contact) => {
      const firstLetter = contact.full_name?.[0]?.toUpperCase() || '#';
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(contact);
      return acc;
    }, {});
    
    setFilteredContacts(grouped);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await loadUserAndContacts();
    setIsRefreshing(false);
  };

  const getContactInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedContacts(new Set());
  };

  const handleContactClick = (contactId) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContacts(newSelection);
  };
  
  const getVisibleContactIds = () => {
    const ids = [];
    Object.values(filteredContacts).forEach(group => {
      group.forEach(contact => ids.push(contact.id));
    });
    return ids;
  };

  const handleSelectAll = () => {
    const visibleIds = getVisibleContactIds();
    if (selectedContacts.size === visibleIds.length && selectedContacts.size > 0) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(visibleIds));
    }
  };

  const handleClearSelection = () => {
    setSelectedContacts(new Set());
    setIsSelectionMode(false);
  };
  
  const createDownload = (filename, content, type) => {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleExportVCF = () => {
    let vcfContent = "";
    const contactsToExport = contacts.filter(contact => selectedContacts.has(contact.id));

    contactsToExport.forEach(contact => {
      vcfContent += "BEGIN:VCARD\n";
      vcfContent += "VERSION:3.0\n";
      vcfContent += `FN:${contact.full_name}\n`;
      if (contact.phone_number) vcfContent += `TEL;TYPE=CELL:${contact.phone_number}\n`;
      if (contact.email) vcfContent += `EMAIL:${contact.email}\n`;
      if (contact.company) vcfContent += `ORG:${contact.company}\n`;
      if (contact.job_title) vcfContent += `TITLE:${contact.job_title}\n`;
      vcfContent += "END:VCARD\n";
    });
    createDownload("contacts.vcf", vcfContent, "text/vcard");
  };

  const handleExportCSV = () => {
    const headers = "Full Name,Phone Number,Email,Company,Job Title";
    let csvRows = [headers];
    const contactsToExport = contacts.filter(contact => selectedContacts.has(contact.id));

    contactsToExport.forEach(contact => {
      const row = [
        `"${contact.full_name ? contact.full_name.replace(/"/g, '""') : ''}"`,
        `"${contact.phone_number ? contact.phone_number.replace(/"/g, '""') : ''}"`,
        `"${contact.email ? contact.email.replace(/"/g, '""') : ''}"`,
        `"${contact.company ? contact.company.replace(/"/g, '""') : ''}"`,
        `"${contact.job_title ? contact.job_title.replace(/"/g, '""') : ''}"`
      ].join(',');
      csvRows.push(row);
    });
    createDownload("contacts.csv", csvRows.join('\n'), "text/csv");
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {isSelectionMode ? (
        <ContactsActionsToolbar
          selectedCount={selectedContacts.size}
          totalCount={getVisibleContactIds().length}
          onSelectAll={handleSelectAll}
          onExportVCF={handleExportVCF}
          onExportCSV={handleExportCSV}
          onCancel={handleClearSelection}
        />
      ) : (
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-medium text-slate-900">Contacts</h1>
              <div className="flex items-center gap-2">
                 <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSelectionMode}
                    className="rounded-full"
                  >
                    <CheckSquare className="w-5 h-5" />
                  </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="rounded-full"
                >
                  <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search contacts"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-slate-50 border-0 rounded-full text-base"
              />
            </div>
          </div>

          <div className="px-4 pb-3">
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{contacts.length} contacts synced</span>
              </div>
              {currentUser && (
                <div className="flex items-center gap-1">
                  <Smartphone className="w-4 h-4" />
                  <span>From {currentUser.phone_number}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {Object.keys(filteredContacts).length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Users className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">
              {searchQuery ? 'No contacts found' : 'No contacts synced'}
            </h3>
            <p className="text-slate-500 text-center max-w-md">
              {searchQuery 
                ? 'Try a different search term' 
                : 'Contacts will appear here once synced from your devices'
              }
            </p>
          </div>
        ) : (
          Object.keys(filteredContacts).sort().map((letter) => (
            <div key={letter}>
              <div className="sticky top-0 bg-slate-50 px-4 py-2 border-b border-slate-100 z-5">
                <h3 className="text-sm font-medium text-slate-600">{letter}</h3>
              </div>

              {filteredContacts[letter].map((contact, index) => {
                const isSelected = selectedContacts.has(contact.id);
                return (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={`px-4 py-3 border-b border-slate-100 transition-colors cursor-pointer flex items-center gap-4 ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => isSelectionMode && handleContactClick(contact.id)}
                  >
                    <div className="w-10 h-10 flex items-center justify-center">
                      {isSelectionMode ? (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleContactClick(contact.id)}
                          className="w-5 h-5"
                          aria-label={`Select ${contact.full_name}`}
                        />
                      ) : (
                        <Avatar className="w-10 h-10">
                          {contact.photo_url ? (
                            <AvatarImage src={contact.photo_url} alt={contact.full_name} />
                          ) : (
                            <AvatarFallback className="bg-blue-500 text-white text-sm font-medium">
                              {getContactInitials(contact.full_name)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0" onClick={() => !isSelectionMode ? {} : handleContactClick(contact.id)}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-slate-900 truncate">
                          {contact.full_name}
                        </h3>
                        {contact.sync_status === 'pending' && (
                          <Badge variant="secondary" className="text-xs">
                            Syncing
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Phone className="w-3 h-3" />
                          <span>{contact.phone_number}</span>
                        </div>
                        {contact.email && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}
                      </div>

                      {contact.company && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <Building className="w-3 h-3" />
                          <span className="truncate">
                            {contact.job_title ? `${contact.job_title} at ${contact.company}` : contact.company}
                          </span>
                        </div>
                      )}

                      {contact.additional_phones && contact.additional_phones.length > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          +{contact.additional_phones.length} more number{contact.additional_phones.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center">
                      {contact.sync_status === 'synced' && (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      )}
                      {contact.sync_status === 'pending' && (
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      )}
                      {contact.sync_status === 'failed' && (
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}