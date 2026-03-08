import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNote, setSelectedNote] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredNotes(notes);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredNotes(notes.filter(n =>
        n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
      ));
    }
  }, [searchQuery, notes]);

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const data = await api.get("/notes?limit=500");
      setNotes(data?.items || []);
      setFilteredNotes(data?.items || []);
    } catch (error) {
      console.error("Error loading notes:", error);
      setNotes([]);
      setFilteredNotes([]);
    }
    setIsLoading(false);
  };

  return (
    <div className="h-screen flex" style={{ background: 'rgb(var(--md-sys-color-background))' }}>
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col bg-white" style={{ borderColor: 'rgb(var(--md-sys-color-outline-variant))' }}>
        <div className="p-6 border-b" style={{ borderColor: 'rgb(var(--md-sys-color-outline-variant))' }}>
          <h1 className="text-2xl font-medium mb-4" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>Notes</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }} />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full border-0 h-10"
              style={{ background: 'rgb(var(--md-sys-color-surface-container-highest))' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'rgb(var(--md-sys-color-primary))' }} />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
              No notes synced yet.
            </div>
          ) : (
            filteredNotes.map((note, idx) => (
              <div
                key={note.id || idx}
                onClick={() => setSelectedNote(note)}
                className={`p-4 border-b cursor-pointer hover:bg-slate-50 transition-colors ${selectedNote?.id === note.id ? 'bg-blue-50' : ''}`}
                style={{ borderColor: 'rgb(var(--md-sys-color-outline-variant))' }}
              >
                <p className="font-medium text-sm truncate" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>
                  {note.title || "Untitled Note"}
                </p>
                <p className="text-xs truncate mt-1" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
                  {note.content}
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgb(var(--md-sys-color-outline))' }}>
                  {note.modified_date
                    ? format(new Date(note.modified_date), 'MMM d, yyyy')
                    : note.created_date
                    ? format(new Date(note.created_date), 'MMM d, yyyy')
                    : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedNote ? (
          <div className="p-8 flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-3 mb-2">
                {selectedNote.device_id && <Badge variant="outline">{selectedNote.device_id}</Badge>}
                <span className="text-xs" style={{ color: 'rgb(var(--md-sys-color-outline))' }}>
                  {selectedNote.modified_date
                    ? format(new Date(selectedNote.modified_date), 'PPpp')
                    : selectedNote.created_date
                    ? format(new Date(selectedNote.created_date), 'PPpp')
                    : ""}
                </span>
              </div>
              <h2 className="text-3xl font-semibold mb-6" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>
                {selectedNote.title || "Untitled Note"}
              </h2>
              <p className="whitespace-pre-wrap text-base leading-relaxed" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>
                {selectedNote.content}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fef9c3 0%, #ffffff 100%)' }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center" style={{ background: 'rgb(var(--md-sys-color-primary-container))' }}>
                <FileText className="w-12 h-12" style={{ color: 'rgb(var(--md-sys-color-on-primary-container))' }} />
              </div>
              <h2 className="text-2xl font-medium mb-2" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>Select a Note</h2>
              <p className="max-w-sm" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
                Notes synced from your Fig Phone will appear here.
              </p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
