import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Phone,
  Mail,
  Building,
  RefreshCw,
  Users,
  MoreVertical,
  CheckSquare,
  Link2,
  Unlink,
  Download,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import ContactsActionsToolbar from "../components/contacts/ContactsActionsToolbar";

// ✅ shadcn/ui toast
import { useToast } from "@/components/ui/use-toast";

export default function ContactsPage() {
  const { toast } = useToast();

  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState(new Set());

  // --- Google integration UI state ---
  const [googleStatus, setGoogleStatus] = useState({
    linked: false,
    lastGoogleSyncAt: null, // pull timestamp (Google -> Figcloud)
    lastGooglePushAt: null, // push timestamp (Figcloud -> Google)
    linkedAt: null,
  });
  const [isGoogleLoading, setIsGoogleLoading] = useState(true);
  const [isGooglePulling, setIsGooglePulling] = useState(false); // Sync FROM Google
  const [isGooglePushing, setIsGooglePushing] = useState(false); // Sync TO Google
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [isGoogleDisconnecting, setIsGoogleDisconnecting] = useState(false);

  // If user comes back from callback like /contacts?google=linked
  const googleLinkedQueryFlag = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("google") === "linked";
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadContacts(), loadGoogleStatus()]);
      if (googleLinkedQueryFlag) {
        await Promise.all([loadContacts(), loadGoogleStatus()]);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("google");
          window.history.replaceState({}, "", url.toString());
        } catch {
          // ignore
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, searchQuery]);

  const loadGoogleStatus = async () => {
    setIsGoogleLoading(true);
    try {
      const res = await api.get("/integrations/google/status");
      setGoogleStatus({
        linked: !!res?.linked,
        lastGoogleSyncAt: res?.lastGoogleSyncAt || null,
        lastGooglePushAt: res?.lastGooglePushAt || null,
        linkedAt: res?.linkedAt || null,
      });
    } catch (error) {
      console.error("Failed to load Google integration status:", error);
      setGoogleStatus({
        linked: false,
        lastGoogleSyncAt: null,
        lastGooglePushAt: null,
        linkedAt: null,
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const loadContacts = async () => {
    if (!isRefreshing) setIsLoading(true);
    try {
      const fetchedContacts = await api.get("/contacts");
      fetchedContacts.sort((a, b) =>
        (a.full_name || "").localeCompare(b.full_name || "")
      );
      setContacts(fetchedContacts);
    } catch (error) {
      console.error("Failed to load contacts:", error);
      toast({
        variant: "destructive",
        title: "Failed to load contacts",
        description: error?.message || "Please try again.",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filterContacts = () => {
    let filtered = contacts;

    if (searchQuery) {
      filtered = contacts.filter(
        (contact) =>
          contact.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.phone_number?.includes(searchQuery) ||
          contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.company?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const grouped = filtered.reduce((acc, contact) => {
      const firstLetter = contact.full_name?.[0]?.toUpperCase() || "#";
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(contact);
      return acc;
    }, {});

    setFilteredContacts(grouped);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadContacts(), loadGoogleStatus()]);
    toast({
      title: "Refreshed ✅",
      description: "Contacts and Google status updated.",
    });
  };

  const getContactInitials = (name) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "??";
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedContacts(new Set());
  };

  const handleContactClick = (contactId) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(contactId)) newSelection.delete(contactId);
    else newSelection.add(contactId);
    setSelectedContacts(newSelection);
  };

  const getVisibleContactIds = () => {
    const ids = [];
    Object.values(filteredContacts).forEach((group) => {
      group.forEach((contact) => ids.push(contact.contactId));
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
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleExportVCF = () => {
    let vcfContent = "";
    const contactsToExport = contacts.filter((contact) =>
      selectedContacts.has(contact.contactId)
    );

    contactsToExport.forEach((contact) => {
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
    toast({
      title: "Exported VCF ✅",
      description: `${contactsToExport.length} contact(s) exported.`,
    });
  };

  const handleExportCSV = () => {
    const headers = "Full Name,Phone Number,Email,Company,Job Title";
    const csvRows = [headers];
    const contactsToExport = contacts.filter((contact) =>
      selectedContacts.has(contact.contactId)
    );

    contactsToExport.forEach((contact) => {
      const row = [
        `"${contact.full_name ? contact.full_name.replace(/"/g, '""') : ""}"`,
        `"${contact.phone_number ? String(contact.phone_number).replace(/"/g, '""') : ""}"`,
        `"${contact.email ? contact.email.replace(/"/g, '""') : ""}"`,
        `"${contact.company ? contact.company.replace(/"/g, '""') : ""}"`,
        `"${contact.job_title ? contact.job_title.replace(/"/g, '""') : ""}"`,
      ].join(",");
      csvRows.push(row);
    });

    createDownload("contacts.csv", csvRows.join("\n"), "text/csv");
    toast({
      title: "Exported CSV ✅",
      description: `${contactsToExport.length} contact(s) exported.`,
    });
  };

  // --- Google connect/sync/disconnect handlers ---

  const handleGoogleConnect = async () => {
    setIsGoogleConnecting(true);
    try {
      const res = await api.post("/integrations/google/connect", {});
      if (!res?.authUrl) throw new Error("Missing authUrl from backend.");
      window.location.href = res.authUrl;
    } catch (e) {
      console.error("Google connect failed:", e);
      toast({
        variant: "destructive",
        title: "Google link failed",
        description: e?.message || "Could not start Google linking flow.",
      });
    } finally {
      setIsGoogleConnecting(false);
    }
  };

  // ✅ Sync FROM Google -> Figcloud (pull)
  const handleGooglePullNow = async () => {
    setIsGooglePulling(true);
    try {
      await api.post("/integrations/google/sync-now", {});
      await Promise.all([loadGoogleStatus(), loadContacts()]);

      toast({
        title: "Synced from Google ✅",
        description: "Imported your Google contacts into Figcloud.",
      });
    } catch (e) {
      console.error("Google pull (sync-now) failed:", e);
      toast({
        variant: "destructive",
        title: "Google sync failed",
        description: e?.message || "Could not sync contacts from Google.",
      });
    } finally {
      setIsGooglePulling(false);
    }
  };

  // ✅ Sync TO Google (push Figcloud -> Google)
  const handleGooglePushNow = async () => {
    setIsGooglePushing(true);
    try {
      const res = await api.post("/integrations/google/push-now", {});
      await Promise.all([loadGoogleStatus(), loadContacts()]);

      const created = res?.created ?? null;
      const updated = res?.updated ?? null;
      const failed = res?.failed ?? null;
      const pushed = res?.pushedThisRun ?? res?.total ?? null;

      const parts = [];
      if (pushed != null) parts.push(`Pushed: ${pushed}`);
      if (created != null) parts.push(`Created: ${created}`);
      if (updated != null) parts.push(`Updated: ${updated}`);
      if (failed != null) parts.push(`Failed: ${failed}`);

      toast({
        title: "Synced to Google ✅",
        description: parts.length
          ? parts.join(" · ")
          : "Exported your Figcloud contacts to Google.",
      });
    } catch (e) {
      console.error("Google push (push-now) failed:", e);
      toast({
        variant: "destructive",
        title: "Google sync failed",
        description: e?.message || "Could not sync contacts to Google.",
      });
    } finally {
      setIsGooglePushing(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    setIsGoogleDisconnecting(true);
    try {
      await api.post("/integrations/google/disconnect", {});
      await Promise.all([loadGoogleStatus(), loadContacts()]);

      toast({
        title: "Google disconnected",
        description: "Your Google account is no longer linked.",
      });
    } catch (e) {
      console.error("Google disconnect failed:", e);
      toast({
        variant: "destructive",
        title: "Disconnect failed",
        description: e?.message || "Could not disconnect Google.",
      });
    } finally {
      setIsGoogleDisconnecting(false);
    }
  };

  // Badge label: show last pull/push if available
  const googleBadge = useMemo(() => {
    if (isGoogleLoading) return "Google: checking…";
    if (!googleStatus.linked) return "Google: not linked";

    const parts = ["Google: linked"];
    if (googleStatus.lastGoogleSyncAt) {
      try {
        parts.push(`↓ ${format(new Date(googleStatus.lastGoogleSyncAt), "PPp")}`);
      } catch {}
    }
    if (googleStatus.lastGooglePushAt) {
      try {
        parts.push(`↑ ${format(new Date(googleStatus.lastGooglePushAt), "PPp")}`);
      } catch {}
    }
    return parts.join(" · ");
  }, [googleStatus, isGoogleLoading]);

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
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-medium text-slate-900">Contacts</h1>
                <Badge
                  variant={googleStatus.linked ? "secondary" : "outline"}
                  className="hidden sm:inline-flex"
                >
                  {googleBadge}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {googleStatus.linked ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={handleGooglePullNow}
                      disabled={isGooglePulling || isGooglePushing || isGoogleDisconnecting}
                      className="rounded-full hidden sm:inline-flex"
                      title="Import contacts from Google into Figcloud"
                    >
                      <Download
                        className={`w-4 h-4 mr-2 ${isGooglePulling ? "animate-pulse" : ""}`}
                      />
                      Sync from Google
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={handleGooglePushNow}
                      disabled={isGooglePushing || isGooglePulling || isGoogleDisconnecting}
                      className="rounded-full hidden sm:inline-flex"
                      title="Export Figcloud contacts to Google"
                    >
                      <Upload
                        className={`w-4 h-4 mr-2 ${isGooglePushing ? "animate-pulse" : ""}`}
                      />
                      Sync to Google
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={handleGoogleDisconnect}
                      disabled={isGoogleDisconnecting || isGooglePulling || isGooglePushing}
                      className="rounded-full hidden sm:inline-flex"
                    >
                      <Unlink className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={handleGoogleConnect}
                    disabled={isGoogleConnecting}
                    className="rounded-full hidden sm:inline-flex"
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    {isGoogleConnecting ? "Linking…" : "Link Google"}
                  </Button>
                )}

                {!googleStatus.linked ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleGoogleConnect}
                    disabled={isGoogleConnecting}
                    className="rounded-full sm:hidden"
                    aria-label="Link Google"
                    title="Link Google"
                  >
                    <Link2 className="w-5 h-5" />
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleGooglePullNow}
                      disabled={isGooglePulling || isGooglePushing || isGoogleDisconnecting}
                      className="rounded-full sm:hidden"
                      aria-label="Sync from Google"
                      title="Sync from Google"
                    >
                      <Download className={`w-5 h-5 ${isGooglePulling ? "animate-pulse" : ""}`} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleGooglePushNow}
                      disabled={isGooglePushing || isGooglePulling || isGoogleDisconnecting}
                      className="rounded-full sm:hidden"
                      aria-label="Sync to Google"
                      title="Sync to Google"
                    >
                      <Upload className={`w-5 h-5 ${isGooglePushing ? "animate-pulse" : ""}`} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleGoogleDisconnect}
                      disabled={isGoogleDisconnecting || isGooglePulling || isGooglePushing}
                      className="rounded-full sm:hidden"
                      aria-label="Disconnect Google"
                      title="Disconnect Google"
                    >
                      <Unlink className="w-5 h-5" />
                    </Button>
                  </>
                )}

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
                  <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
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
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {Object.keys(filteredContacts).length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Users className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">
              {searchQuery ? "No contacts found" : "No contacts synced"}
            </h3>
            <p className="text-slate-500 text-center max-w-md">
              {searchQuery
                ? "Try a different search term"
                : "Contacts will appear here once synced from your devices"}
            </p>
          </div>
        ) : (
          Object.keys(filteredContacts)
            .sort()
            .map((letter) => (
              <div key={letter}>
                <div className="sticky top-0 bg-slate-50 px-4 py-2 border-b border-slate-100 z-5">
                  <h3 className="text-sm font-medium text-slate-600">{letter}</h3>
                </div>

                {filteredContacts[letter].map((contact, index) => {
                  const isSelected = selectedContacts.has(contact.contactId);
                  return (
                    <motion.div
                      key={contact.contactId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className={`px-4 py-3 border-b border-slate-100 transition-colors cursor-pointer flex items-center gap-4 ${
                        isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                      onClick={() => isSelectionMode && handleContactClick(contact.contactId)}
                    >
                      <div className="w-10 h-10 flex items-center justify-center">
                        {isSelectionMode ? (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleContactClick(contact.contactId)}
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

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 truncate">
                          {contact.full_name || "No Name"}
                        </h3>

                        <div className="flex items-center gap-3 mt-1">
                          {contact.phone_number && (
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <Phone className="w-3 h-3" />
                              <span>{contact.phone_number}</span>
                            </div>
                          )}
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
                              {contact.job_title
                                ? `${contact.job_title} at ${contact.company}`
                                : contact.company}
                            </span>
                          </div>
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
