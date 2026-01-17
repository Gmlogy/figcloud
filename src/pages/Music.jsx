import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import {
  Music2,
  Search,
  Loader2,
  Play,
  Pause,
  Download,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

/**
 * Music.jsx
 * - Infinite scroll + "Load more"
 * - Search
 * - Built-in player (HTML5 audio)
 * - Works with backend response: { items: [...], nextToken: "..." }
 * - Fallback: if item.file_url missing, fetch /music/download-url?musicId=...
 */

const PAGE_LIMIT = 50;

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(ms) {
  const n = Number(ms || 0);
  if (!n) return "";
  const totalSec = Math.floor(n / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function safeText(v) {
  return (v || "").toString().trim();
}

export default function MusicPage() {
  const [tracks, setTracks] = useState([]);
  const [nextToken, setNextToken] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Cache signed URLs per musicId (useful if backend doesn’t include file_url in list)
  const [urlCache, setUrlCache] = useState(() => new Map());

  const audioRef = useRef(null);
  const sentinelRef = useRef(null);
  const hasMore = !!nextToken;

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tracks;

    return tracks.filter((t) => {
      const title = safeText(t.title || t.fileName || t.file_name);
      const artist = safeText(t.artist);
      const album = safeText(t.album);
      const fileName = safeText(t.fileName || t.file_name || t.s3Key);

      return (
        title.toLowerCase().includes(q) ||
        artist.toLowerCase().includes(q) ||
        album.toLowerCase().includes(q) ||
        fileName.toLowerCase().includes(q)
      );
    });
  }, [tracks, search]);

  const fetchPage = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      try {
        setError("");

        if (append) setIsLoadingMore(true);
        else setIsLoading(true);

        const qs = new URLSearchParams();
        qs.set("limit", String(PAGE_LIMIT));
        if (cursor) qs.set("nextToken", cursor);

        const resp = await api.get(`/music?${qs.toString()}`);
        const items = resp?.items || [];
        const token = resp?.nextToken || null;

        setTracks((prev) => (append ? [...prev, ...items] : items));
        setNextToken(token);
      } catch (e) {
        console.error("Failed to load music:", e);
        setError("Failed to load music. Please try again.");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPage({ cursor: null, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll observer (loads more when sentinel becomes visible)
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (!hasMore) return;
        if (isLoading || isLoadingMore) return;

        fetchPage({ cursor: nextToken, append: true });
      },
      { root: null, rootMargin: "600px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchPage, hasMore, isLoading, isLoadingMore, nextToken]);

  const resolvePlayableUrl = useCallback(
    async (track) => {
      // 1) Prefer file_url from list
      if (track?.file_url) return track.file_url;

      // 2) Check cache
      const id = track?.musicId;
      if (id && urlCache.has(id)) return urlCache.get(id);

      // 3) Fallback to download-url endpoint
      if (!id) return null;

      const resp = await api.get(`/music/download-url?musicId=${encodeURIComponent(id)}`);
      const url = resp?.url || resp?.file_url || null;

      if (url) {
        setUrlCache((prev) => {
          const next = new Map(prev);
          next.set(id, url);
          return next;
        });
      }
      return url;
    },
    [urlCache]
  );

  const stopPlayback = useCallback(() => {
    try {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
    } catch {}
    setIsPlaying(false);
    setActiveId(null);
  }, []);

  const togglePlay = useCallback(
    async (track) => {
      const id = track?.musicId || track?.id;
      if (!id) return;

      const a = audioRef.current;
      if (!a) return;

      // If clicking the currently active track, toggle play/pause
      if (activeId === id) {
        if (a.paused) {
          await a.play().catch(() => {});
          setIsPlaying(true);
        } else {
          a.pause();
          setIsPlaying(false);
        }
        return;
      }

      // New track: load URL and play
      const url = await resolvePlayableUrl(track);
      if (!url) {
        setError("No playable URL for this track.");
        return;
      }

      try {
        a.pause();
        a.src = url;
        a.load();
        await a.play();
        setActiveId(id);
        setIsPlaying(true);
      } catch (e) {
        console.error("Audio play failed:", e);
        setError("Playback failed (maybe the signed URL expired). Try again.");
        setIsPlaying(false);
        setActiveId(null);
      }
    },
    [activeId, resolvePlayableUrl]
  );

  const downloadTrack = async (track) => {
  try {
    // track.file_url is your signed GET url
    const res = await fetch(track.file_url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;

    // pick a good filename
    const safeTitle = (track.title || track.file_name || "track").replace(/[\\/:*?"<>|]+/g, "_");
    const ext = (track.mimeType === "audio/mpeg") ? "mp3" : "";
    a.download = ext ? `${safeTitle}.${ext}` : safeTitle;

    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Download failed", e);
  }
};


  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore || isLoading) return;
    fetchPage({ cursor: nextToken, append: true });
  };

  const handleRefresh = () => {
    stopPlayback();
    fetchPage({ cursor: null, append: false });
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: "linear-gradient(to bottom, #f0f9ff, #ffffff)" }}>
      {/* Header */}
      <div
        className="p-6 border-b"
        style={{ background: "rgb(var(--md-sys-color-surface))", borderColor: "rgb(var(--md-sys-color-outline-variant))" }}
      >
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: "rgb(var(--md-sys-color-on-surface))" }}>
              Music
            </h2>
            <p className="text-sm" style={{ color: "rgb(var(--md-sys-color-on-surface-variant))" }}>
              {tracks.length} tracks synced from your device
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl border w-full md:w-[360px]"
              style={{
                background: "rgb(var(--md-sys-color-surface-container-low))",
                borderColor: "rgb(var(--md-sys-color-outline-variant))",
              }}
            >
              <Search className="w-4 h-4" style={{ color: "rgb(var(--md-sys-color-on-surface-variant))" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search music..."
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: "rgb(var(--md-sys-color-on-surface))" }}
              />
            </div>

            <button
              onClick={handleRefresh}
              className="px-3 py-2 rounded-xl border flex items-center gap-2"
              style={{
                background: "rgb(var(--md-sys-color-surface-container-low))",
                borderColor: "rgb(var(--md-sys-color-outline-variant))",
                color: "rgb(var(--md-sys-color-on-surface))",
              }}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden md:inline text-sm font-medium">Refresh</span>
            </button>
          </div>
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-4 px-4 py-3 rounded-xl border text-sm"
              style={{
                background: "rgba(186, 26, 26, 0.06)",
                borderColor: "rgba(186, 26, 26, 0.25)",
                color: "rgb(var(--md-sys-color-on-surface))",
              }}
            >
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center gap-3 text-sm" style={{ color: "rgb(var(--md-sys-color-on-surface-variant))" }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading music…
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-10">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: "rgb(var(--md-sys-color-primary-container))" }}
              >
                <Music2 className="w-8 h-8" style={{ color: "rgb(var(--md-sys-color-on-primary-container))" }} />
              </div>
              <h3 className="mt-5 text-lg font-semibold" style={{ color: "rgb(var(--md-sys-color-on-surface))" }}>
                No music found
              </h3>
              <p className="mt-2 text-sm" style={{ color: "rgb(var(--md-sys-color-on-surface-variant))" }}>
                Try syncing again or change your search.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-2">
              {filteredTracks.map((t) => {
                const id = t.musicId || t.id;
                const title = safeText(t.title) || safeText(t.fileName || t.file_name) || "Unknown title";
                const artist = safeText(t.artist) || "Unknown artist";
                const album = safeText(t.album);
                const metaLeft = [artist, album].filter(Boolean).join(" • ");
                const size = formatBytes(t.sizeBytes);
                const dur = formatDuration(t.durationMs);
                const isActive = activeId === id;

                return (
                  <motion.div
                    key={id}
                    layout
                    className="material-card px-4 py-3 flex items-center gap-3"
                    style={{
                      background: "rgb(var(--md-sys-color-surface-container-low))",
                      borderColor: "rgb(var(--md-sys-color-outline-variant))",
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderRadius: 14,
                    }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    {/* Play */}
                    <button
                      onClick={() => togglePlay(t)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center border"
                      style={{
                        background: isActive ? "rgb(var(--md-sys-color-primary-container))" : "rgb(var(--md-sys-color-surface-container-high))",
                        borderColor: "rgb(var(--md-sys-color-outline-variant))",
                      }}
                      title={isActive && isPlaying ? "Pause" : "Play"}
                    >
                      {isActive && isPlaying ? (
                        <Pause className="w-5 h-5" style={{ color: "rgb(var(--md-sys-color-on-primary-container))" }} />
                      ) : (
                        <Play className="w-5 h-5" style={{ color: "rgb(var(--md-sys-color-on-surface))" }} />
                      )}
                    </button>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium truncate" style={{ color: "rgb(var(--md-sys-color-on-surface))" }}>
                          {title}
                        </p>
                        {dur ? (
                          <span
                            className="text-xs px-2 py-1 rounded-lg border whitespace-nowrap"
                            style={{
                              background: "rgb(var(--md-sys-color-surface-container-high))",
                              borderColor: "rgb(var(--md-sys-color-outline-variant))",
                              color: "rgb(var(--md-sys-color-on-surface-variant))",
                            }}
                          >
                            {dur}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-sm truncate" style={{ color: "rgb(var(--md-sys-color-on-surface-variant))" }}>
                        {metaLeft}
                      </p>

                      <p className="text-xs mt-1" style={{ color: "rgb(var(--md-sys-color-on-surface-variant))" }}>
                        {[size, safeText(t.mimeType)].filter(Boolean).join(" • ")}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadTrack(t)}
                        className="px-3 py-2 rounded-xl border flex items-center gap-2"
                        style={{
                          background: "rgb(var(--md-sys-color-surface-container-high))",
                          borderColor: "rgb(var(--md-sys-color-outline-variant))",
                          color: "rgb(var(--md-sys-color-on-surface))",
                        }}
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden md:inline text-sm font-medium">Download</span>
                      </button>

                      {t.file_url ? (
                        <a
                          href={t.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 rounded-xl border flex items-center gap-2"
                          style={{
                            background: "rgb(var(--md-sys-color-surface-container-high))",
                            borderColor: "rgb(var(--md-sys-color-outline-variant))",
                            color: "rgb(var(--md-sys-color-on-surface))",
                          }}
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="hidden md:inline text-sm font-medium">Open</span>
                        </a>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Load more (manual) */}
            <div className="mt-6 flex items-center justify-center">
              {hasMore ? (
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="px-5 py-3 rounded-2xl border flex items-center gap-3"
                  style={{
                    background: "rgb(var(--md-sys-color-primary-container))",
                    borderColor: "rgb(var(--md-sys-color-outline-variant))",
                    color: "rgb(var(--md-sys-color-on-primary-container))",
                    opacity: isLoadingMore ? 0.8 : 1,
                  }}
                >
                  {isLoadingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : <Music2 className="w-5 h-5" />}
                  <span className="font-medium">{isLoadingMore ? "Loading…" : "Load more"}</span>
                </button>
              ) : (
                <div className="text-sm" style={{ color: "rgb(var(--md-sys-color-on-surface-variant))" }}>
                  
                </div>
              )}
            </div>

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-10" />
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => {
          setIsPlaying(false);
        }}
        onPause={() => {
          // If pause was manual, keep activeId but reflect state
          setIsPlaying(false);
        }}
        onPlay={() => setIsPlaying(true)}
      />
    </div>
  );
}
