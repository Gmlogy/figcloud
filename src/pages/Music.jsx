import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import {
  Music,
  Search,
  Loader2,
  Play,
  Pause,
  Download,
  RefreshCw,
  ExternalLink,
  Disc,
  Users,
  SkipBack,
  SkipForward,
  Volume2,
  ListMusic,
  ChevronLeft,
} from "lucide-react";

const PAGE_LIMIT = 50;
const VIEWS = ["Songs", "Artists", "Albums"];

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

  const [view, setView] = useState("Songs");
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);

  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const [urlCache, setUrlCache] = useState(() => new Map());

  const audioRef = useRef(null);
  const sentinelRef = useRef(null);
  const hasMore = !!nextToken;

  const fetchPage = useCallback(async ({ cursor = null, append = false } = {}) => {
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
  }, []);

  useEffect(() => {
    fetchPage({ cursor: null, append: false });
  }, [fetchPage]);

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
      if (track?.file_url) return track.file_url;

      const id = track?.musicId || track?.id;
      if (id && urlCache.has(id)) return urlCache.get(id);

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
    setQueue([]);
    setCurrentIndex(-1);
  }, []);

  const playTrackFromList = useCallback(
    async (trackList, idx) => {
      const track = trackList?.[idx];
      if (!track) return;

      const id = track?.musicId || track?.id;
      if (!id) return;

      const a = audioRef.current;
      if (!a) return;

      try {
        setError("");
        const url = await resolvePlayableUrl(track);
        if (!url) {
          setError("No playable URL for this track.");
          return;
        }

        a.pause();
        a.src = url;
        a.load();
        await a.play();

        setQueue(trackList);
        setCurrentIndex(idx);
        setActiveId(id);
        setIsPlaying(true);
      } catch (e) {
        console.error("Audio play failed:", e);
        setError("Playback failed (maybe the signed URL expired). Try again.");
        setIsPlaying(false);
        setActiveId(null);
      }
    },
    [resolvePlayableUrl]
  );

  const toggleTrack = useCallback(
    async (track, trackList = [], idx = 0) => {
      const id = track?.musicId || track?.id;
      const a = audioRef.current;
      if (!id || !a) return;

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

      await playTrackFromList(trackList, idx);
    },
    [activeId, playTrackFromList]
  );

  const playNext = useCallback(async () => {
    if (!queue.length) return;
    const nextIdx = Math.min(currentIndex + 1, queue.length - 1);
    if (nextIdx !== currentIndex) {
      await playTrackFromList(queue, nextIdx);
    }
  }, [queue, currentIndex, playTrackFromList]);

  const playPrev = useCallback(async () => {
    if (!queue.length) return;
    const prevIdx = Math.max(currentIndex - 1, 0);
    if (prevIdx !== currentIndex) {
      await playTrackFromList(queue, prevIdx);
    }
  }, [queue, currentIndex, playTrackFromList]);

  const downloadTrack = async (track) => {
    try {
      let url = track.file_url;
      if (!url) {
        url = await resolvePlayableUrl(track);
      }
      if (!url) throw new Error("Missing download URL");

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;

      const safeTitle = (track.title || track.file_name || track.fileName || "track").replace(
        /[\\/:*?"<>|]+/g,
        "_"
      );
      const ext =
        track.mimeType === "audio/mpeg"
          ? "mp3"
          : track.mimeType === "audio/flac"
          ? "flac"
          : track.mimeType === "audio/wav"
          ? "wav"
          : "";
      a.download = ext ? `${safeTitle}.${ext}` : safeTitle;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Download failed", e);
      setError("Download failed.");
    }
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore || isLoading) return;
    fetchPage({ cursor: nextToken, append: true });
  };

  const handleRefresh = () => {
    stopPlayback();
    setSelectedGroup(null);
    fetchPage({ cursor: null, append: false });
  };

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...tracks];

    if (!q) return list;

    return list.filter((t) => {
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

  const artistMap = useMemo(() => {
    const map = {};
    filteredTracks.forEach((t) => {
      const key = safeText(t.artist) || "Unknown Artist";
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [filteredTracks]);

  const albumMap = useMemo(() => {
    const map = {};
    filteredTracks.forEach((t) => {
      const key = safeText(t.album) || "Unknown Album";
      if (!map[key]) {
        map[key] = {
          tracks: [],
          artist: safeText(t.artist) || "Unknown Artist",
          art: t.album_art_url || null,
        };
      }
      map[key].tracks.push(t);
    });
    return map;
  }, [filteredTracks]);

  const currentTrack = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= queue.length) return null;
    return queue[currentIndex];
  }, [queue, currentIndex]);

  const viewIcon = (v) => {
    if (v === "Songs") return <Music className="w-4 h-4" />;
    if (v === "Artists") return <Users className="w-4 h-4" />;
    if (v === "Albums") return <Disc className="w-4 h-4" />;
    return <ListMusic className="w-4 h-4" />;
  };

  const renderSongs = () => {
    if (filteredTracks.length === 0) {
      return <EmptyLibrary search={search} />;
    }

    return (
      <div className="flex-1 overflow-y-auto bg-[#fcfcfd] pb-32">
        <div className="min-w-[900px]">
          <div
            className="grid items-center px-6 h-11 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400 border-b bg-white sticky top-0 z-10"
            style={{
              gridTemplateColumns: "52px minmax(320px, 1fr) minmax(180px, 260px) 70px 40px",
              borderColor: "#edf0f3",
            }}
          >
            <div>#</div>
            <div>Title</div>
            <div className="text-right pr-8">Album</div>
            <div className="text-right">Time</div>
            <div></div>
          </div>

          {filteredTracks.map((t, i) => {
            const id = t.musicId || t.id;
            const title =
              safeText(t.title) || safeText(t.fileName || t.file_name) || "Unknown title";
            const artist = safeText(t.artist) || "Unknown artist";
            const album = safeText(t.album) || "";
            const duration = formatDuration(t.durationMs);
            const isActive = activeId === id;

            return (
              <div
                key={id}
                className={`grid items-center px-6 h-[58px] transition-colors border-b group ${
                  isActive ? "bg-slate-100" : "bg-transparent hover:bg-slate-50"
                }`}
                style={{
                  gridTemplateColumns: "52px minmax(320px, 1fr) minmax(180px, 260px) 70px 40px",
                  borderColor: "#f2f4f7",
                }}
              >
                <div className="flex items-center justify-center text-slate-400 text-sm font-medium">
                  <button
                    onClick={() => toggleTrack(t, filteredTracks, i)}
                    className="w-7 h-7 flex items-center justify-center rounded-md opacity-80 hover:opacity-100"
                    title={isActive && isPlaying ? "Pause" : "Play"}
                  >
                    {isActive && isPlaying ? (
                      <Pause className="w-4 h-4 text-slate-700" />
                    ) : (
                      <>
                        <span className="group-hover:hidden">{i + 1}</span>
                        <Play className="w-4 h-4 text-slate-700 hidden group-hover:block ml-0.5" />
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {t.album_art_url ? (
                      <img src={t.album_art_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-4 h-4 text-slate-700" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-slate-800 leading-5">
                      {title}
                    </p>
                    <p className="truncate text-[14px] text-slate-500 leading-5">{artist}</p>
                  </div>
                </div>

                <div className="truncate text-right pr-8 text-[15px] text-slate-400">
                  {album || "—"}
                </div>

                <div className="text-right text-[15px] text-slate-400 font-medium">
                  {duration || "—"}
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={() => downloadTrack(t)}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="flex items-center justify-center py-6">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="px-4 py-2 rounded-xl border bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
                style={{ borderColor: "#e5e7eb" }}
              >
                {isLoadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ListMusic className="w-4 h-4" />
                )}
                {isLoadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}

          <div ref={sentinelRef} className="h-8" />
        </div>
      </div>
    );
  };

  const renderArtists = () => {
    if (selectedGroup) {
      const artistTracks = artistMap[selectedGroup] || [];

      return (
        <div className="flex-1 overflow-y-auto pb-32 bg-[#fcfcfd]">
          <div
            className="px-6 py-4 flex items-center gap-3 border-b bg-white"
            style={{ borderColor: "rgb(var(--md-sys-color-outline-variant))" }}
          >
            <button
              onClick={() => setSelectedGroup(null)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <ChevronLeft className="w-4 h-4" />
              Artists
            </button>
            <span className="text-slate-400">/</span>
            <span className="font-semibold truncate">{selectedGroup}</span>
            <span className="text-slate-400 text-sm ml-auto">{artistTracks.length} songs</span>
          </div>

          <div className="px-3 py-3 space-y-1">
            {artistTracks.map((t, i) => {
              const id = t.musicId || t.id;
              const title =
                safeText(t.title) || safeText(t.fileName || t.file_name) || "Unknown title";
              const album = safeText(t.album) || "Unknown album";
              const duration = formatDuration(t.durationMs);
              const isActive = activeId === id;

              return (
                <div
                  key={id}
                  className="rounded-2xl border px-3 py-2 flex items-center gap-3"
                  style={{
                    background: isActive
                      ? "rgb(var(--md-sys-color-primary-container))"
                      : "rgb(var(--md-sys-color-surface-container-low))",
                    borderColor: "rgb(var(--md-sys-color-outline-variant))",
                  }}
                >
                  <button
                    onClick={() => toggleTrack(t, artistTracks, i)}
                    className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                    style={{
                      background: "rgb(var(--md-sys-color-surface-container-high))",
                      borderColor: "rgb(var(--md-sys-color-outline-variant))",
                    }}
                  >
                    {isActive && isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{title}</p>
                    <p className="text-sm truncate text-slate-500">{album}</p>
                  </div>

                  <div className="text-sm text-slate-500">{duration}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const artists = Object.keys(artistMap).sort((a, b) => a.localeCompare(b));

    if (!artists.length) return <EmptyLibrary search={search} />;

    return (
      <div className="flex-1 overflow-y-auto pb-32 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-4 content-start bg-[#fcfcfd]">
        {artists.map((artist) => {
          const artistTracks = artistMap[artist];
          const art = artistTracks.find((t) => t.album_art_url)?.album_art_url;

          return (
            <motion.div
              key={artist}
              onClick={() => setSelectedGroup(artist)}
              whileHover={{ y: -2 }}
              className="rounded-2xl border cursor-pointer hover:shadow-md transition-all overflow-hidden"
              style={{
                background: "rgb(var(--md-sys-color-surface-container-low))",
                borderColor: "rgb(var(--md-sys-color-outline-variant))",
              }}
            >
              <div
                className="aspect-square flex items-center justify-center overflow-hidden"
                style={{ background: "rgb(var(--md-sys-color-secondary-container))" }}
              >
                {art ? (
                  <img src={art} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users
                    className="w-8 h-8"
                    style={{ color: "rgb(var(--md-sys-color-on-secondary-container))" }}
                  />
                )}
              </div>

              <div className="p-3">
                <p className="font-medium text-sm truncate">{artist}</p>
                <p className="text-xs text-slate-400">{artistTracks.length} songs</p>
              </div>
            </motion.div>
          );
        })}

        <div ref={sentinelRef} className="h-10 col-span-full" />
      </div>
    );
  };

  const renderAlbums = () => {
    if (selectedGroup) {
      const album = albumMap[selectedGroup];
      const albumTracks = album?.tracks || [];

      return (
        <div className="flex-1 overflow-y-auto pb-32 bg-[#fcfcfd]">
          <div
            className="flex items-center gap-6 px-8 py-6 border-b bg-white"
            style={{ borderColor: "rgb(var(--md-sys-color-outline-variant))" }}
          >
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
              style={{ background: "rgb(var(--md-sys-color-primary-container))" }}
            >
              {album?.art ? (
                <img src={album.art} alt="" className="w-full h-full object-cover" />
              ) : (
                <Disc
                  className="w-10 h-10"
                  style={{ color: "rgb(var(--md-sys-color-on-primary-container))" }}
                />
              )}
            </div>

            <div className="min-w-0">
              <button
                onClick={() => setSelectedGroup(null)}
                className="flex items-center gap-1 text-blue-600 text-sm hover:underline"
              >
                <ChevronLeft className="w-4 h-4" />
                Albums
              </button>

              <h2 className="text-2xl font-bold mt-1 truncate">{selectedGroup}</h2>
              <p className="text-slate-500 text-sm">
                {album?.artist || "Various Artists"} • {albumTracks.length} songs
              </p>

              {!!albumTracks.length && (
                <button
                  onClick={() => playTrackFromList(albumTracks, 0)}
                  className="mt-3 px-4 py-2 rounded-xl border inline-flex items-center gap-2"
                  style={{
                    background: "rgb(var(--md-sys-color-primary-container))",
                    borderColor: "rgb(var(--md-sys-color-outline-variant))",
                    color: "rgb(var(--md-sys-color-on-primary-container))",
                  }}
                >
                  <Play className="w-4 h-4" />
                  Play All
                </button>
              )}
            </div>
          </div>

          <div className="px-3 py-3 space-y-1">
            {albumTracks.map((t, i) => {
              const id = t.musicId || t.id;
              const title =
                safeText(t.title) || safeText(t.fileName || t.file_name) || "Unknown title";
              const artist = safeText(t.artist) || "Unknown artist";
              const duration = formatDuration(t.durationMs);
              const isActive = activeId === id;

              return (
                <div
                  key={id}
                  className="rounded-2xl border px-3 py-2 flex items-center gap-3"
                  style={{
                    background: isActive
                      ? "rgb(var(--md-sys-color-primary-container))"
                      : "rgb(var(--md-sys-color-surface-container-low))",
                    borderColor: "rgb(var(--md-sys-color-outline-variant))",
                  }}
                >
                  <button
                    onClick={() => toggleTrack(t, albumTracks, i)}
                    className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                    style={{
                      background: "rgb(var(--md-sys-color-surface-container-high))",
                      borderColor: "rgb(var(--md-sys-color-outline-variant))",
                    }}
                  >
                    {isActive && isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{title}</p>
                    <p className="text-sm truncate text-slate-500">{artist}</p>
                  </div>

                  <div className="text-sm text-slate-500">{duration}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const albums = Object.keys(albumMap).sort((a, b) => a.localeCompare(b));

    if (!albums.length) return <EmptyLibrary search={search} />;

    return (
      <div className="flex-1 overflow-y-auto pb-32 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-4 content-start bg-[#fcfcfd]">
        {albums.map((albumName) => {
          const info = albumMap[albumName];

          return (
            <motion.div
              key={albumName}
              onClick={() => setSelectedGroup(albumName)}
              whileHover={{ y: -2 }}
              className="rounded-2xl border cursor-pointer hover:shadow-md transition-all overflow-hidden"
              style={{
                background: "rgb(var(--md-sys-color-surface-container-low))",
                borderColor: "rgb(var(--md-sys-color-outline-variant))",
              }}
            >
              <div
                className="aspect-square flex items-center justify-center overflow-hidden"
                style={{ background: "rgb(var(--md-sys-color-primary-container))" }}
              >
                {info.art ? (
                  <img src={info.art} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Disc
                    className="w-8 h-8"
                    style={{ color: "rgb(var(--md-sys-color-on-primary-container))" }}
                  />
                )}
              </div>

              <div className="p-3">
                <p className="font-medium text-sm truncate">{albumName}</p>
                <p className="text-xs text-slate-400 truncate">{info.artist || "Unknown Artist"}</p>
              </div>
            </motion.div>
          );
        })}

        <div ref={sentinelRef} className="h-10 col-span-full" />
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center gap-3 text-sm text-slate-500 bg-[#fcfcfd]">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading library...
        </div>
      );
    }

    if (view === "Songs") return renderSongs();
    if (view === "Artists") return renderArtists();
    return renderAlbums();
  };

  return (
    <div className="h-full flex flex-col bg-[#fcfcfd]">
      <div
        className="flex items-center gap-4 px-6 py-5 border-b shrink-0 bg-white"
        style={{ borderColor: "rgb(var(--md-sys-color-outline-variant))" }}
      >
        <div className="flex items-center gap-3 shrink-0">
          <Music className="w-6 h-6" style={{ color: "rgb(var(--md-sys-color-primary))" }} />
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Music</h1>
        </div>

        <div className="flex gap-2 ml-6">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setSelectedGroup(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                view === v ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {viewIcon(v)}
              {v}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="relative w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search music..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full border bg-[#fafafa] outline-none text-sm text-slate-700"
              style={{ borderColor: "#e5e7eb" }}
            />
          </div>

          <button
            onClick={handleRefresh}
            className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 bg-white hover:bg-slate-50"
            style={{ borderColor: "#e5e7eb" }}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mx-6 mt-4 px-4 py-3 rounded-xl border text-sm"
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

      <div className="flex-1 min-h-0 overflow-hidden">{renderContent()}</div>

      {currentTrack ? (
        <div
          className="border-t px-4 py-3 shrink-0 bg-white"
          style={{ borderColor: "rgb(var(--md-sys-color-outline-variant))" }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 bg-blue-100">
              {currentTrack.album_art_url ? (
                <img src={currentTrack.album_art_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Music className="w-5 h-5 text-slate-700" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-medium truncate text-slate-900">
                {safeText(currentTrack.title) ||
                  safeText(currentTrack.fileName || currentTrack.file_name) ||
                  "Unknown title"}
              </p>
              <p className="text-sm truncate text-slate-500">
                {safeText(currentTrack.artist) || "Unknown artist"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={playPrev}
                disabled={currentIndex <= 0}
                className="w-10 h-10 rounded-xl border flex items-center justify-center disabled:opacity-40 bg-white hover:bg-slate-50"
                style={{ borderColor: "#e5e7eb" }}
              >
                <SkipBack className="w-4 h-4 text-slate-700" />
              </button>

              <button
                onClick={() => {
                  const a = audioRef.current;
                  if (!a) return;
                  if (a.paused) {
                    a.play().catch(() => {});
                  } else {
                    a.pause();
                  }
                }}
                className="w-12 h-12 rounded-xl border flex items-center justify-center bg-blue-600 text-white"
                style={{ borderColor: "#2563eb" }}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <button
                onClick={playNext}
                disabled={currentIndex >= queue.length - 1}
                className="w-10 h-10 rounded-xl border flex items-center justify-center disabled:opacity-40 bg-white hover:bg-slate-50"
                style={{ borderColor: "#e5e7eb" }}
              >
                <SkipForward className="w-4 h-4 text-slate-700" />
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 text-slate-500">
              <Volume2 className="w-4 h-4" />
              <span className="text-sm">
                {formatDuration(currentTrack.durationMs)} • {formatBytes(currentTrack.sizeBytes)}
              </span>
            </div>

            {currentTrack.file_url ? (
              <a
                href={currentTrack.file_url}
                target="_blank"
                rel="noreferrer"
                className="hidden md:flex w-10 h-10 rounded-xl border items-center justify-center bg-white hover:bg-slate-50"
                style={{ borderColor: "#e5e7eb" }}
                title="Open"
              >
                <ExternalLink className="w-4 h-4 text-slate-700" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <audio
        ref={audioRef}
        onEnded={() => {
          if (currentIndex < queue.length - 1) {
            playTrackFromList(queue, currentIndex + 1);
          } else {
            setIsPlaying(false);
          }
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
    </div>
  );
}

function EmptyLibrary({ search }) {
  return (
    <div className="flex-1 flex items-center justify-center flex-col gap-4 pb-20 bg-[#fcfcfd]">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center bg-blue-100">
        <Music className="w-10 h-10 text-slate-700" />
      </div>

      <h2 className="text-xl font-semibold text-slate-700">
        {search ? "No matching music" : "No Music Yet"}
      </h2>

      <p className="text-slate-400 text-sm text-center max-w-xs">
        {search
          ? "Try a different title, artist, or album."
          : "Music synced from your Fig Phone will appear here. Make sure music backup is enabled in the app."}
      </p>
    </div>
  );
}
