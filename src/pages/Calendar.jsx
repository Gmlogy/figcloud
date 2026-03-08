import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, MapPin, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { motion } from "framer-motion";

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const data = await api.get("/calendar/events?limit=1000");
      setEvents(data?.items || []);
    } catch (error) {
      console.error("Error loading events:", error);
      setEvents([]);
    }
    setIsLoading(false);
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getEventsForDay = (day) =>
    events.filter(e => e.start_time && isSameDay(parseISO(e.start_time), day));

  const selectedDayEvents = getEventsForDay(selectedDate).sort(
    (a, b) => new Date(a.start_time) - new Date(b.start_time)
  );

  const startDayOfWeek = startOfMonth(currentMonth).getDay();

  return (
    <div className="h-screen flex" style={{ background: 'rgb(var(--md-sys-color-background))' }}>
      {/* Calendar Panel */}
      <div className="w-96 border-r flex flex-col bg-white" style={{ borderColor: 'rgb(var(--md-sys-color-outline-variant))' }}>
        <div className="p-6 border-b" style={{ borderColor: 'rgb(var(--md-sys-color-outline-variant))' }}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-medium" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>Calendar</h1>
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'rgb(var(--md-sys-color-primary))' }} />}
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-base" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>{d}</div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
            {daysInMonth.map(day => {
              const dayEvents = getEventsForDay(day);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentDay = isToday(day);
              const inMonth = isSameMonth(day, currentMonth);
              return (
                <button
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className="relative flex flex-col items-center py-1 rounded-full transition-colors"
                  style={{
                    background: isSelected ? 'rgb(var(--md-sys-color-primary))' : 'transparent',
                    color: isSelected
                      ? 'rgb(var(--md-sys-color-on-primary))'
                      : isCurrentDay
                      ? 'rgb(var(--md-sys-color-primary))'
                      : inMonth
                      ? 'rgb(var(--md-sys-color-on-surface))'
                      : 'rgb(var(--md-sys-color-outline))',
                    fontWeight: isCurrentDay || isSelected ? '700' : '400',
                  }}
                >
                  <span className="text-sm w-8 h-8 flex items-center justify-center rounded-full">
                    {format(day, 'd')}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{
                      background: isSelected ? 'rgba(255,255,255,0.8)' : 'rgb(var(--md-sys-color-primary))'
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Events count */}
        <div className="px-6 py-3 text-sm" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
          {events.length} total events synced
        </div>
      </div>

      {/* Events Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8 py-6 border-b" style={{ borderColor: 'rgb(var(--md-sys-color-outline-variant))' }}>
          <h2 className="text-xl font-semibold" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>
            {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {selectedDayEvents.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center h-full">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4" style={{ background: 'rgb(var(--md-sys-color-primary-container))' }}>
                <CalendarIcon className="w-10 h-10" style={{ color: 'rgb(var(--md-sys-color-on-primary-container))' }} />
              </div>
              <p className="text-lg font-medium mb-1" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>No events</p>
              <p className="text-sm" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>No events synced for this day.</p>
            </motion.div>
          ) : (
            <div className="space-y-4 max-w-2xl">
              {selectedDayEvents.map((event, idx) => (
                <motion.div
                  key={event.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-2xl border"
                  style={{
                    background: 'rgb(var(--md-sys-color-surface-container-low))',
                    borderColor: 'rgb(var(--md-sys-color-outline-variant))'
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-base" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>
                      {event.title}
                    </h3>
                    {event.calendar_name && (
                      <Badge variant="outline" className="text-xs ml-2 shrink-0">{event.calendar_name}</Badge>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {event.is_all_day ? (
                      <div className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
                        <Clock className="w-4 h-4" />
                        <span>All day</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
                        <Clock className="w-4 h-4" />
                        <span>
                          {event.start_time && format(parseISO(event.start_time), 'h:mm a')}
                          {event.end_time && ` \u2013 ${format(parseISO(event.end_time), 'h:mm a')}`}
                        </span>
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    {event.description && (
                      <p className="text-sm mt-2 pt-2 border-t" style={{
                        color: 'rgb(var(--md-sys-color-on-surface-variant))',
                        borderColor: 'rgb(var(--md-sys-color-outline-variant))'
                      }}>
                        {event.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
