import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import DOMPurify from 'dompurify';
import { 
  Search, MonitorPlay, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, CheckCircle2, 
  Plus, LayoutDashboard, CalendarDays, Bell, X, Info,
  BookOpen, Clock, Maximize, Minimize, Share2, Youtube,
  Moon, Sun, Inbox, PauseCircle, AlertTriangle
} from 'lucide-react';

const mergeFreshData = (staleList, freshList) => {
  return staleList.map(staleItem => {
    const freshItem = freshList.find(f => f.id === staleItem.id);
    if (freshItem) {
      return { ...freshItem, isStale: false };
    }
    return { ...staleItem, isStale: true };
  });
};

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatTimeRemaining = (targetTimestamp, now) => {
  if (targetTimestamp === 'HIATUS') return 'On Hiatus';
  if (!targetTimestamp) return 'Release time TBA';
  
  const targetDate = new Date(targetTimestamp * 1000);
  const diffMs = targetDate - now;

  if (diffMs <= 0) {
    const gracePeriod = 12 * 60 * 60 * 1000;
    if (Math.abs(diffMs) < gracePeriod) return 'Out Now!';
    return 'Waiting for next drop';
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (days > 0) return `${days}d ${hours}h ${mins}m ${secs}s`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
};

const getNextMangaTimestamp = (schedule, now) => {
  if (!schedule) return null;
  if (schedule.onHiatus) return 'HIATUS';
  if (schedule.dayOfWeek === '' || !schedule.time || schedule.time.includes('undefined') || schedule.time === ':') return null;

  const { dayOfWeek, time } = schedule;
  const [hours, minutes] = time.split(':').map(Number);
  
  let target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  
  let daysToWait = dayOfWeek - target.getDay();
  
  const msPassed = now.getTime() - target.getTime();
  const gracePeriod = 12 * 60 * 60 * 1000;
  
  if (daysToWait < 0 || (daysToWait === 0 && msPassed > gracePeriod)) {
    daysToWait += 7;
  }
  
  target.setDate(target.getDate() + daysToWait);
  return Math.floor(target.getTime() / 1000);
};

const FadeImage = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-[var(--text-espresso)]/5 flex items-center justify-center ${className}`}>
      {hasError ? (
        <AlertTriangle className="text-[var(--text-espresso)]/20" size={32} />
      ) : (
        <img 
          src={src || ''} 
          alt={alt} 
          onLoad={() => setIsLoaded(true)} 
          onError={() => setHasError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} 
          loading="lazy" 
        />
      )}
    </div>
  );
};

const SkeletonCard = ({ isAnime }) => (
  <div className="bg-[var(--card-bg)] rounded-3xl p-4 shadow-sm border border-[var(--border-light)] flex flex-col animate-pulse transition-colors duration-500">
    <div className={`w-full bg-[var(--border-light)] mb-4 ${isAnime ? 'rounded-2xl aspect-[3/4]' : 'rounded-r-2xl rounded-l-sm aspect-[2/3] border-l-8 border-black/5'}`}></div>
    <div className="h-6 bg-[var(--border-light)] rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-[var(--border-light)] rounded w-1/2 mt-auto"></div>
  </div>
);

const DayDropdown = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (
    <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div onClick={() => !disabled && setIsOpen(!isOpen)} className="w-full bg-[var(--card-bg)] border-2 border-[var(--border-med)] dark:border-white/20 rounded-xl p-3 flex justify-between items-center cursor-pointer dark:bg-[#1A1A1A] dark:text-[#EAEAEA] text-[var(--text-espresso)] font-bold transition-colors">
        <span>{value !== '' && value !== null && value !== undefined ? days[value] : 'Select a Day'}</span>
        <span className="text-xs">▼</span>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--card-bg)] dark:bg-[#1A1A1A] border-2 border-[var(--border-med)] dark:border-white/20 shadow-lg rounded-xl overflow-hidden">
          {days.map((day, idx) => (
            <div key={day} onClick={() => { onChange(idx); setIsOpen(false); }} className="p-3 hover:bg-[var(--border-light)] dark:hover:bg-white/10 cursor-pointer text-[var(--text-espresso)] dark:text-[#EAEAEA] font-bold transition-colors">{day}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const DetailsModal = ({ 
  media, onClose, onZen, isAnime, accentColor, 
  isPinned, isScheduled, onPin, onSchedule 
}) => {
  if (!media) return null;
  const descriptionHtml = media.description ? DOMPurify.sanitize(media.description) : 'No synopsis available for this title.';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 ease-out" onClick={onClose}>
      <div className="bg-[var(--bg-main)] border-2 border-[var(--border-med)] rounded-3xl max-h-[85vh] w-[95vw] max-w-4xl flex flex-col md:flex-row overflow-hidden shadow-2xl relative transition-colors duration-500" onClick={e => e.stopPropagation()}>
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button onClick={onZen} className="p-2 rounded-full shadow-md transition-all duration-300 ease-out bg-[var(--card-bg)]/90 hover:bg-[var(--card-bg)] text-[var(--text-espresso)] active:scale-95" title="Zen Mode">
            <Maximize size={20} />
          </button>
          <button onClick={onClose} className="p-2 rounded-full shadow-md transition-all duration-300 ease-out bg-[var(--card-bg)]/90 hover:bg-[var(--card-bg)] text-[var(--text-espresso)] active:scale-95">
            <X size={20} />
          </button>
        </div>

        <div className="w-full h-48 md:h-auto md:w-2/5 shrink-0 relative border-b-2 md:border-b-0 md:border-r-2 border-[var(--border-light)] bg-black">
          <FadeImage src={media.image} className={`w-full h-full opacity-90 ${media.isStale ? 'grayscale-[20%]' : ''}`} alt={media.title} />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col custom-scrollbar">
          <h2 className="text-3xl md:text-4xl font-black text-[var(--text-espresso)] mb-4 leading-tight">{media.title}</h2>

          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
            {media.score && (
              <div className="flex items-center gap-1 bg-[var(--card-bg)] px-3 py-1 rounded-xl border-2 border-yellow-400/30 shadow-sm">
                <span className="text-yellow-500 text-sm">⭐</span>
                <span className="font-black text-[var(--text-espresso)]">{media.score}%</span>
              </div>
            )}
            {media.genres?.map(genre => (
              <span key={genre} className="px-3 py-1 bg-[var(--border-light)] text-[var(--text-espresso)] rounded-md text-xs font-black uppercase tracking-wider">
                {genre}
              </span>
            ))}
          </div>

          {media.platforms && media.platforms.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {media.platforms.map((p, i) => (
                <a key={`${p.site}-${i}`} href={p.url} target="_blank" rel="noopener noreferrer" className={`px-3 py-1 rounded-full text-white text-xs font-bold shadow-sm ${accentColor} hover:opacity-80 hover:shadow-md transition-all duration-300 ease-out active:scale-95`}>
                  {p.site}
                </a>
              ))}
            </div>
          )}
          
          {(media.totalEpisodes || media.totalChapters || media.totalEpisodes === 0 || media.totalChapters === 0) && (
            <div className="mb-4">
              <span className="px-3 py-1 inline-block rounded-full bg-[var(--card-bg)] border border-[var(--border-med)] text-[var(--text-espresso)] text-xs font-bold shadow-sm">
                {isAnime ? 'Episodes' : 'Chapters'}: {media.totalEpisodes || media.totalChapters || '?'}
              </span>
            </div>
          )}
          
          <div className="text-[var(--text-espresso)]/80 text-sm md:text-base leading-relaxed mb-6 flex-1" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
          
          <div className="mt-auto pt-6 shrink-0 flex flex-wrap gap-3 border-t border-[var(--border-light)]">
            {media.trailerId && (
              <a href={`https://youtube.com/watch?v=${media.trailerId}`} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-red-600/10 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-all duration-300 ease-out active:scale-95">
                <Youtube size={18}/> Watch Trailer
              </a>
            )}
            <div className="flex flex-1 flex-wrap gap-2 md:gap-4">
              <button 
                onClick={onPin}
                className={`flex-1 min-w-[120px] py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 ease-out active:scale-95 ${
                  isPinned ? `${accentColor} text-white shadow-md` : 'bg-[var(--card-bg)] border-2 border-[var(--border-med)] text-[var(--text-espresso)] hover:border-[var(--text-espresso)]/40'
                }`}
              >
                {isPinned ? 'Pinned ✓' : 'Pin to Board'}
              </button>
              <button 
                onClick={onSchedule}
                className={`flex-1 min-w-[120px] py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 ease-out active:scale-95 ${
                  isScheduled ? `${accentColor} text-white shadow-md` : 'bg-[var(--card-bg)] border-2 border-[var(--border-med)] text-[var(--text-espresso)] hover:border-[var(--text-espresso)]/40'
                }`}
              >
                {isAnime ? (isScheduled ? 'Scheduled ✓' : 'Add to Planner') : (isScheduled ? 'Time Set ✓' : 'Set Schedule')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShareCardModal = ({ onClose, activePinned, isAnime, mediaProgress, mediaByDay, mangaSchedules, currentTime }) => {
  const completedCount = activePinned.filter(m => {
    const max = isAnime ? m.totalEpisodes : m.totalChapters;
    return max > 0 && mediaProgress[m.id] >= max;
  }).length;

  return (
    <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
       <div className="bg-[#121212] bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f] rounded-3xl p-8 max-w-sm w-full mx-auto shadow-2xl relative overflow-hidden flex flex-col gap-6 border border-white/5 aspect-[9/16]">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay pointer-events-none"></div>
           
           <div className="text-center relative z-10 shrink-0">
               <h2 className="text-3xl md:text-4xl font-black tracking-tighter drop-shadow-lg text-white">AniDrop</h2>
               <p className="text-[10px] md:text-xs font-bold text-white/50 uppercase tracking-widest mt-1">Weekly Wrap</p>
           </div>
           
           <div className="flex gap-4 justify-center relative z-10 shrink-0">
              <div className="bg-white/5 rounded-2xl p-4 text-center flex-1 border border-white/10 shadow-lg backdrop-blur-md max-w-[200px]">
                 <div className="text-2xl md:text-3xl mb-1">🏆</div>
                 <div className="text-2xl md:text-3xl font-black drop-shadow-md text-white">
                   {completedCount}
                 </div>
                 <div className="text-[10px] text-white/50 font-bold uppercase mt-1">Completed</div>
              </div>
           </div>

           <div className="relative z-10 shrink-0">
               <h3 className="font-bold text-white/80 mb-3 text-xs md:text-sm uppercase tracking-wider text-center">Top Drops This Week</h3>
               <div className="space-y-3">
                  {mediaByDay.flat().slice(0,3).map((m, i) => (
                     <div key={m.id} className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/10 shadow-sm backdrop-blur-sm text-white">
                        <span className="font-black text-lg md:text-xl text-white/20 w-6 text-center">{i+1}</span>
                        <img src={m.image} className="w-10 h-10 rounded-lg object-cover shadow-sm" alt="" />
                        <div className="flex-1 min-w-0">
                           <div className="font-bold text-xs md:text-sm truncate drop-shadow-sm">{m.title}</div>
                           <div className="text-[10px] text-white/50 font-mono truncate">
                              {isAnime ? 'Anime' : 'Manga'} • {new Date((isAnime ? m.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[m.id], currentTime)) * 1000).toLocaleDateString('en-US', {weekday:'short'})}
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
           </div>
           
           <div className="mt-auto text-center pt-4 opacity-30 text-[10px] font-black tracking-widest uppercase relative z-10 shrink-0 text-white">
              anidrop.app
           </div>
       </div>
       
       <div className="flex flex-col items-center mt-6 z-10 shrink-0">
         <button onClick={onClose} className="px-8 py-3 bg-white text-black font-black rounded-full shadow-2xl hover:scale-105 transition-all duration-300 active:scale-95">
            Close
         </button>
         <p className="mt-4 text-white/50 text-[10px] md:text-xs font-bold animate-pulse">Screenshot to share!</p>
       </div>
    </div>
  );
};

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => JSON.parse(localStorage.getItem('isDarkMode') || 'false'));
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mediaMode, setMediaMode] = useState('anime');
  const [viewMode, setViewMode] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // NEW: Bulletproof Internal Notification States
  const [notifsEnabled, setNotifsEnabled] = useState(Notification.permission === 'granted');
  const [notifications, setNotifications] = useState(() => JSON.parse(localStorage.getItem('appNotifications') || '[]'));
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);

  const [showToast, setShowToast] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);

  const [defaultCache, setDefaultCache] = useState({ anime: [], manga: [] });
  const [searchData, setSearchData] = useState([]);

  const [pinnedAnime, setPinnedAnime] = useState(() => JSON.parse(localStorage.getItem('pinnedAnime') || '[]'));
  const [pinnedManga, setPinnedManga] = useState(() => JSON.parse(localStorage.getItem('pinnedManga') || '[]'));
  const [scheduledAnime, setScheduledAnime] = useState(() => JSON.parse(localStorage.getItem('scheduledAnime') || '[]'));
  const [scheduledManga, setScheduledManga] = useState(() => JSON.parse(localStorage.getItem('scheduledManga') || '[]'));
  const [mangaSchedules, setMangaSchedules] = useState(() => JSON.parse(localStorage.getItem('mangaSchedules') || '{}'));
  const [dismissedDrops, setDismissedDrops] = useState(() => JSON.parse(localStorage.getItem('dismissedDrops') || '[]'));
  const [mediaProgress, setMediaProgress] = useState(() => JSON.parse(localStorage.getItem('mediaProgress') || '{}'));

  const [platformFilter, setPlatformFilter] = useState('All');
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(null);

  const [detailsMedia, setDetailsMedia] = useState(null);
  const [zenModeMedia, setZenModeMedia] = useState(null);
  const [scheduleModalMedia, setScheduleModalMedia] = useState(null);
  
  const [scheduleDay, setScheduleDay] = useState('');
  const [scheduleHour, setScheduleHour] = useState('');
  const [scheduleMinute, setScheduleMinute] = useState('');
  const [customHiatus, setCustomHiatus] = useState(false);

  const fetchControllerRef = useRef(null);
  const hasFetchedRef = useRef({ anime: false, manga: false });

  const isAnime = mediaMode === 'anime';
  const accentColor = isAnime ? 'bg-[var(--accent-matcha)]' : 'bg-[var(--accent-taro)]';
  const accentText = isAnime ? 'text-[var(--accent-matcha)]' : 'text-[var(--accent-taro)]';
  const ringAccent = isAnime ? 'focus:ring-[var(--accent-matcha)] hover:ring-[var(--accent-matcha)]/50' : 'focus:ring-[var(--accent-taro)] hover:ring-[var(--accent-taro)]/50';

  const baseData = debouncedQuery ? searchData : (defaultCache[mediaMode] || []);

  const activePlatforms = useMemo(() => {
    return ['All', ...new Set(baseData.flatMap(m => m.platforms.map(p => p.site)))].filter(Boolean).sort();
  }, [baseData]);

  const filteredMedia = useMemo(() => {
    if (platformFilter === 'All') return baseData;
    return baseData.filter(m => m.platforms.some(p => p.site === platformFilter));
  }, [baseData, platformFilter]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.style.setProperty('--bg-main', '#0F0F0F');
      document.documentElement.style.setProperty('--bg-cream', '#1A1A1A');
      document.documentElement.style.setProperty('--text-espresso', '#EAEAEA');
      document.documentElement.style.setProperty('--card-bg', '#1A1A1A');
      document.documentElement.style.setProperty('--border-light', 'rgba(255,255,255,0.1)');
      document.documentElement.style.setProperty('--border-med', 'rgba(255,255,255,0.2)');
      document.documentElement.style.setProperty('--manga-pages', '#2A2A2A');
    } else {
      document.documentElement.style.setProperty('--bg-main', '#FAF8F5');
      document.documentElement.style.setProperty('--bg-cream', '#F0EBE1');
      document.documentElement.style.setProperty('--text-espresso', '#8B5A2B');
      document.documentElement.style.setProperty('--card-bg', '#FFFFFF');
      document.documentElement.style.setProperty('--border-light', 'rgba(139, 90, 43, 0.1)');
      document.documentElement.style.setProperty('--border-med', 'rgba(139, 90, 43, 0.2)');
      document.documentElement.style.setProperty('--manga-pages', '#EFECE6');
    }
    document.documentElement.style.setProperty('--accent-matcha', '#8A9A5B');
    document.documentElement.style.setProperty('--accent-taro', '#9B8EA9');
    
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => { setPlatformFilter('All'); }, [mediaMode]);
  useEffect(() => { localStorage.setItem('pinnedAnime', JSON.stringify(pinnedAnime)); }, [pinnedAnime]);
  useEffect(() => { localStorage.setItem('pinnedManga', JSON.stringify(pinnedManga)); }, [pinnedManga]);
  useEffect(() => { localStorage.setItem('scheduledAnime', JSON.stringify(scheduledAnime)); }, [scheduledAnime]);
  useEffect(() => { localStorage.setItem('scheduledManga', JSON.stringify(scheduledManga)); }, [scheduledManga]);
  useEffect(() => { localStorage.setItem('mangaSchedules', JSON.stringify(mangaSchedules)); }, [mangaSchedules]);
  useEffect(() => { localStorage.setItem('dismissedDrops', JSON.stringify(dismissedDrops)); }, [dismissedDrops]);
  useEffect(() => { localStorage.setItem('mediaProgress', JSON.stringify(mediaProgress)); }, [mediaProgress]);
  useEffect(() => { localStorage.setItem('appNotifications', JSON.stringify(notifications)); }, [notifications]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 600);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchMedia = useCallback(async (force = false) => {
    if (!force && !debouncedQuery && hasFetchedRef.current[mediaMode]) return;
    
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    fetchControllerRef.current = new AbortController();

    if (baseData.length === 0) setLoading(true);
    setErrorMsg(null);
    try {
      const query = `
        query ($search: String, $type: MediaType) {
          Page(page: 1, perPage: 25) {
            media(search: $search, type: $type, status: RELEASING, sort: POPULARITY_DESC) {
              id
              title { english romaji }
              coverImage { extraLarge }
              description
              episodes
              chapters
              status
              averageScore
              genres
              externalLinks { site url }
              trailer { id site }
              nextAiringEpisode { airingAt episode }
            }
          }
        }
      `;

      const variables = { type: mediaMode.toUpperCase() };
      if (debouncedQuery.trim() !== '') variables.search = debouncedQuery;

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: fetchControllerRef.current.signal
      });

      if (!res.ok) {
        if (res.status === 429) throw new Error("Rate limit hit. Please wait.");
        throw new Error("Failed to fetch.");
      }

      const json = await res.json();
      const fetchedList = json.data.Page.media.map(a => {
        const platformMap = new Map();
        if (a.externalLinks) {
          a.externalLinks.forEach(link => {
            if (link.site && link.url && !platformMap.has(link.site)) {
              platformMap.set(link.site, link);
            }
          });
        }
        
        return {
          id: a.id,
          title: a.title.english || a.title.romaji,
          image: a.coverImage.extraLarge,
          description: a.description,
          totalEpisodes: a.episodes || null,
          totalChapters: a.chapters || null,
          status: a.status,
          score: a.averageScore || null,
          genres: a.genres || [],
          platforms: Array.from(platformMap.values()),
          nextEpisodeTimestamp: a.nextAiringEpisode?.airingAt || null,
          nextEpisodeNumber: a.nextAiringEpisode?.episode || null,
          trailerId: a.trailer?.site === 'youtube' ? a.trailer.id : null,
        }
      });

      if (debouncedQuery) {
        setSearchData(fetchedList);
      } else {
        setDefaultCache(prev => ({ ...prev, [mediaMode]: fetchedList }));
        setSearchData([]);
        hasFetchedRef.current[mediaMode] = true;
      }

      if (mediaMode === 'anime') {
        setPinnedAnime(prev => mergeFreshData(prev, fetchedList));
        setScheduledAnime(prev => mergeFreshData(prev, fetchedList));
      } else {
        setPinnedManga(prev => mergeFreshData(prev, fetchedList));
        setScheduledManga(prev => mergeFreshData(prev, fetchedList));
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message || 'Network Error.');
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, mediaMode, baseData.length]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchMedia(true);
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchMedia]);


  // ==========================================
  // BULLETPROOF NOTIFICATION ENGINE
  // ==========================================
  useEffect(() => {
    const checkDrops = () => {
      const nowSecs = Math.floor(Date.now() / 1000);

      const allMedia = [...pinnedAnime, ...scheduledAnime, ...pinnedManga, ...scheduledManga];
      const uniqueShows = Array.from(new Map(allMedia.filter(Boolean).map(item => [item.id, item])).values());

      uniqueShows.forEach(media => {
        let rawTs = media.nextEpisodeTimestamp;
        if (!rawTs && typeof getNextMangaTimestamp === 'function') {
          rawTs = getNextMangaTimestamp(mangaSchedules?.[media.id], new Date());
        }

        if (!rawTs || rawTs === 'HIATUS') return;

        let targetTs = rawTs instanceof Date ? Math.floor(rawTs.getTime() / 1000) : Number(rawTs);
        if (targetTs > 10000000000) { 
          targetTs = Math.floor(targetTs / 1000);
        }

        const diff = targetTs - nowSecs;
        const notifyId = `${media.id}-${targetTs}`;

        // Expanded window: 10 minutes BEFORE the drop, up to 1 minute AFTER
        if (diff > -60 && diff <= 600) {
          setNotifications(prev => {
            // Deduplicate: If it's already in the internal tray, do not fire again.
            if (prev.some(n => n.id === notifyId)) return prev;

            const timeMsg = diff > 0 ? `Drops in ${Math.ceil(diff / 60)} minutes!` : `Dropped just now!`;
            const newNotif = {
              id: notifyId,
              title: media.title,
              message: timeMsg,
              image: media.image,
              timestamp: Date.now(),
              read: false
            };

            // Attempt strictly gated OS Alert
            if (notifsEnabled && Notification.permission === 'granted') {
              const title = 'AniDrop Alert!';
              const options = { body: timeMsg, icon: media.image };

              try {
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(title, options);
                  }).catch(() => new Notification(title, options));
                } else {
                  new Notification(title, options);
                }
              } catch(e) {
                try { new Notification(title, options); } catch(fallbackErr) {}
              }
            }

            // Push to internal tray (limit to 50 to prevent localstorage bloat)
            return [newNotif, ...prev].slice(0, 50);
          });
        }
      });
    };

    checkDrops();
    const interval = setInterval(checkDrops, 10000);
    return () => clearInterval(interval);
  }, [pinnedAnime, scheduledAnime, pinnedManga, scheduledManga, mangaSchedules, notifsEnabled]);

  const toggleOSNotifs = () => {
    if (Notification.permission === 'granted') {
      setNotifsEnabled(prev => !prev);
    } else if (Notification.permission === 'denied') {
      alert("Notifications are completely blocked! Please click the lock icon in your browser's URL bar to allow them.");
    } else {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') setNotifsEnabled(true);
      });
    }
  };

  const markAllNotifsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifs = () => {
    setNotifications([]);
    setIsNotifMenuOpen(false);
  };
  // ==========================================


  const togglePin = (media, e) => {
    if (e) e.stopPropagation();
    if (isAnime) {
      if (pinnedAnime.some(p => p.id === media.id)) setPinnedAnime(prev => prev.filter(p => p.id !== media.id));
      else setPinnedAnime(prev => [...prev, media]);
    } else {
      if (pinnedManga.some(p => p.id === media.id)) setPinnedManga(prev => prev.filter(p => p.id !== media.id));
      else setPinnedManga(prev => [...prev, media]);
    }
  };

  const openScheduleModal = (media, e) => {
    if (e) e.stopPropagation();
    const existing = mangaSchedules[media.id];
    if (existing) {
      setScheduleDay(existing.dayOfWeek);
      const [h, m] = existing.time ? existing.time.split(':') : ['', ''];
      setScheduleHour(h ? parseInt(h) : '');
      setScheduleMinute(m ? parseInt(m) : '');
      setCustomHiatus(existing.onHiatus || false);
    } else {
      setScheduleDay('');
      setScheduleHour('');
      setScheduleMinute('');
      setCustomHiatus(false);
    }
    setScheduleModalMedia(media);
  };

  const toggleSchedule = (media, e) => {
    if (e) e.stopPropagation();
    if (isAnime) {
      setScheduledAnime(prev => prev.some(s => s.id === media.id) ? prev.filter(s => s.id !== media.id) : [...prev, media]);
    } else {
      openScheduleModal(media, e);
    }
  };

  const saveMangaSchedule = () => {
    if (!scheduleModalMedia) return;
    if (!customHiatus && (isNaN(parseInt(scheduleHour)) || isNaN(parseInt(scheduleMinute)))) return;
    const timeStr = (!customHiatus && scheduleHour !== '' && scheduleMinute !== '') 
      ? `${scheduleHour.toString().padStart(2, '0')}:${scheduleMinute.toString().padStart(2, '0')}`
      : '';
    setMangaSchedules(prev => ({
      ...prev,
      [scheduleModalMedia.id]: { dayOfWeek: scheduleDay, time: timeStr, onHiatus: customHiatus }
    }));
    setScheduledManga(prev => prev.some(s => s.id === scheduleModalMedia.id) ? prev : [...prev, scheduleModalMedia]);
    setScheduleModalMedia(null);
  };

  const handleRemoveMangaSchedule = () => {
    if (!scheduleModalMedia) return;
    setMangaSchedules(prev => {
      const next = { ...prev };
      delete next[scheduleModalMedia.id];
      return next;
    });
    setScheduledManga(prev => prev.filter(s => s.id !== scheduleModalMedia.id));
    setScheduleModalMedia(null);
  };

  const dismissDrop = (id) => {
    setDismissedDrops(prev => [...prev, id]);
  };

  const activePinned = isAnime ? pinnedAnime : pinnedManga;
  const activeScheduled = isAnime ? scheduledAnime : scheduledManga;

  const mediaByDay = useMemo(() => {
    const list = baseData.filter(m => platformFilter === 'All' || m.platforms.some(p => p.site === platformFilter));
    const grouped = Array(7).fill(null).map(() => []);

    list.forEach(media => {
      const targetTs = isAnime ? media.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[media.id], currentTime);
      if (targetTs && targetTs !== 'HIATUS') {
        const localDay = new Date(targetTs * 1000).getDay();
        grouped[localDay].push(media);
      }
    });

    grouped.forEach(dayArray => {
      dayArray.sort((a, b) => {
        const tsA = isAnime ? a.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[a.id], currentTime);
        const tsB = isAnime ? b.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[b.id], currentTime);
        return tsA - tsB;
      });
    });

    return grouped;
  }, [baseData, platformFilter, mangaSchedules, currentTime, isAnime]);


  const renderCard = (media) => {
    const isPinned = isAnime ? pinnedAnime.some(p => p.id === media.id) : pinnedManga.some(p => p.id === media.id);
    const isScheduled = isAnime ? scheduledAnime.some(s => s.id === media.id) : !!mangaSchedules[media.id];
    
    let targetTs = isAnime ? media.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[media.id], currentTime);
    const dismissId = `${media.id}-${targetTs}`;
    const isDismissed = dismissedDrops.includes(dismissId);
    const isHiatus = targetTs === 'HIATUS';
    
    let timeLeftText = formatTimeRemaining(targetTs, currentTime);
    if (isDismissed) timeLeftText = 'Skipped this week';
    const isLive = timeLeftText === 'Out Now!';

    const currentProgress = parseInt(mediaProgress[media.id]) || 0;
    const maxProgress = isAnime ? (media.totalEpisodes || 0) : (media.totalChapters || 0);
    const isCompleted = maxProgress > 0 && currentProgress >= maxProgress;

    return (
      <div className={`bg-[var(--card-bg)] p-3 shadow-md border-2 border-[var(--border-light)] flex flex-col group relative transition-colors duration-500 ease-out ${!isAnime ? 'border-r-[6px] border-b-2 border-[var(--manga-pages)] shadow-[inset_12px_0_12px_-4px_rgba(0,0,0,0.35)] rounded-r-2xl rounded-l-md' : 'rounded-3xl'}`}>
        <div 
          className={`relative h-48 md:h-64 overflow-hidden mb-3 shadow-inner cursor-pointer transition-all duration-300 ease-out ${!isAnime ? 'rounded-r-xl rounded-l-sm' : 'rounded-2xl'}`}
          onClick={() => setDetailsMedia(media)}
        >
          <FadeImage src={media.image} alt={media.title} className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${media.isStale ? 'opacity-80 grayscale-[20%]' : ''}`} />
          
          {media.isStale && (
            <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm border border-white/10 flex items-center gap-1">
              <Clock size={10} /> Offline
            </div>
          )}
          
          <div className="absolute top-3 right-3 flex flex-row gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
            <button 
              onClick={(e) => { e.stopPropagation(); setDetailsMedia(media); }}
              className="p-2 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-md transition-colors shadow-lg active:scale-95"
              title="Details"
            >
              <Info size={16} />
            </button>
            <button 
              onClick={(e) => togglePin(media, e)}
              className={`p-2 rounded-full backdrop-blur-md transition-colors shadow-lg active:scale-95 ${isPinned ? `${accentColor} text-white` : 'bg-black/60 hover:bg-black/90 text-white'}`}
              title={isPinned ? "Unpin" : "Pin to Board"}
            >
              <Plus size={16} className={isPinned ? "rotate-45 transition-transform" : "transition-transform"} />
            </button>
            <button 
              onClick={(e) => toggleSchedule(media, e)}
              className={`p-2 rounded-full backdrop-blur-md transition-colors shadow-lg active:scale-95 ${isScheduled ? `${accentColor} text-white` : 'bg-black/60 hover:bg-black/90 text-white'}`}
              title={isScheduled ? "Edit Schedule" : "Set Schedule"}
            >
              {isAnime ? <CalendarIcon size={16} /> : <Clock size={16} />}
            </button>
          </div>
          
          <div className="absolute bottom-2 left-2 flex gap-1 flex-wrap z-10">
            {media.platforms.slice(0,2).map(plat => (
              <span key={plat.site} className={`text-[10px] px-2 py-1 rounded-full text-white font-bold shadow-sm ${accentColor}/90 backdrop-blur-md`}>
                {plat.site}
              </span>
            ))}
          </div>
        </div>
        
        <h3 className="font-bold text-[var(--text-espresso)] text-sm md:text-lg leading-tight line-clamp-2 mb-1 transition-colors duration-500">{media.title}</h3>
        
        {isPinned && (
          <div className="flex items-center justify-between bg-[var(--bg-cream)] border border-[var(--border-light)] rounded-lg p-2 mb-2 shadow-inner transition-colors duration-500">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setMediaProgress(prev => ({ ...prev, [media.id]: Math.max(0, currentProgress - 1) }));
              }}
              className="w-6 h-6 rounded-md bg-[var(--card-bg)] border border-[var(--border-med)] text-[var(--text-espresso)] flex items-center justify-center font-bold hover:bg-[var(--text-espresso)]/10 active:scale-95 transition-all duration-300 ease-out"
            >
              -
            </button>
            <span className="text-xs font-bold text-[var(--text-espresso)]/80 font-mono transition-colors duration-500 flex items-center gap-1">
              {isAnime ? 'Ep' : 'Ch'}
              <input
                type="number"
                min="0"
                max={maxProgress > 0 ? maxProgress : 9999}
                value={Number.isNaN(currentProgress) ? '' : (currentProgress === 0 ? 0 : currentProgress || '')}
                onChange={(e) => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val)) val = 0;
                  setMediaProgress(prev => ({...prev, [media.id]: maxProgress > 0 && val > maxProgress ? maxProgress : val}));
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-10 text-center bg-transparent outline-none border-b border-transparent focus:border-[var(--text-espresso)] dark:focus:border-white/50 appearance-none m-0 p-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              / {maxProgress > 0 ? maxProgress : '?'}
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setMediaProgress(prev => ({ ...prev, [media.id]: maxProgress > 0 ? Math.min(maxProgress, currentProgress + 1) : currentProgress + 1 }));
              }}
              className="w-6 h-6 rounded-md bg-[var(--card-bg)] border border-[var(--border-med)] text-[var(--text-espresso)] flex items-center justify-center font-bold hover:bg-[var(--text-espresso)]/10 active:scale-95 transition-all duration-300 ease-out"
            >
              +
            </button>
          </div>
        )}
        
        <div className="mt-auto">
          {isCompleted ? (
            <div className={`rounded-xl p-3 mb-2 flex items-center justify-center gap-2 bg-[var(--card-bg)] border border-[var(--border-med)] text-[var(--text-espresso)] font-bold text-sm transition-colors duration-500 ${isAnime ? 'text-[var(--accent-matcha)]' : 'text-[var(--accent-taro)]'}`}>
              🎉 Fully Caught Up
            </div>
          ) : isHiatus ? (
            <div className="rounded-xl p-3 mb-2 flex items-center justify-center gap-2 bg-[var(--bg-cream)] border-2 border-dashed border-[var(--border-med)] text-[var(--text-espresso)]/60 font-bold text-sm transition-colors duration-500">
              <PauseCircle className="opacity-50" size={16}/> On Hiatus
            </div>
          ) : (!isAnime && !mangaSchedules[media.id]) ? (
             <div className="mb-2"></div>
          ) : (
            <div className={`mb-2 py-2 px-3 rounded-xl text-center shadow-inner relative overflow-hidden transition-all duration-500 ${
              isLive ? `bg-gradient-to-r from-[var(--accent-matcha)] to-[var(--accent-taro)] animate-pulse border-transparent` : 'bg-[var(--bg-cream)] border border-[var(--border-light)]'
            }`}>
              <div className={`font-mono text-xs md:text-sm tracking-tight font-bold tabular-nums z-10 relative ${isLive ? 'text-white' : accentText}`}>
                {timeLeftText}
              </div>
              {isLive && (
                <button 
                  onClick={(e) => { e.stopPropagation(); dismissDrop(dismissId); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-black/20 hover:bg-black/40 rounded-full text-white z-20 transition-colors active:scale-95"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4 shrink-0 flex-wrap">
            <button 
              onClick={(e) => togglePin(media, e)}
              className={`flex-1 min-w-[80px] py-2 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-1 transition-all duration-300 ease-out active:scale-95 ${
                isPinned ? `${accentColor} text-white shadow-md` : 'bg-[var(--bg-cream)] border border-[var(--border-light)] text-[var(--text-espresso)] hover:border-[var(--border-med)]'
              }`}
            >
              {isPinned ? 'Pinned ✓' : 'Pin'}
            </button>
            <button 
              onClick={(e) => toggleSchedule(media, e)}
              className={`flex-1 min-w-[110px] py-2 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-1 transition-all duration-300 ease-out active:scale-95 ${
                isScheduled ? `${accentColor} text-white shadow-md` : 'bg-[var(--bg-cream)] border border-[var(--border-light)] text-[var(--text-espresso)] hover:border-[var(--border-med)]'
              }`}
            >
              {isAnime ? (isScheduled ? 'Scheduled ✓' : 'Add to Planner') : (isScheduled ? 'Time Set ✓' : 'Set Schedule')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMiniCard = (media) => {
    let targetTs = isAnime ? media.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[media.id], currentTime);
    const dismissId = `${media.id}-${targetTs}`;
    const isDismissed = dismissedDrops.includes(dismissId);
    const isHiatus = targetTs === 'HIATUS';
    
    let timeLeftText = formatTimeRemaining(targetTs, currentTime);
    if (isDismissed) timeLeftText = 'Skipped this week';
    
    return (
      <div 
        className={`relative group aspect-square rounded-2xl overflow-hidden shadow-md cursor-pointer hover:scale-105 transition-all duration-300 ease-out ring-2 ring-transparent hover:ring-[var(--border-med)] ${isHiatus ? 'grayscale opacity-70' : ''}`}
        onClick={() => setDetailsMedia(media)}
        title={`${media.title} - ${timeLeftText}`}
      >
        <FadeImage src={media.image} alt={media.title} className={`w-full h-full ${media.isStale ? 'opacity-80 grayscale-[20%]' : ''}`} />
        {media.isStale && (
          <div className="absolute top-1 left-1 z-10 bg-black/60 backdrop-blur-md text-white text-[8px] font-bold px-1 rounded shadow-sm border border-white/10 flex items-center gap-1">
            <Clock size={8} /> Offline
          </div>
        )}
        {isHiatus && (
          <div className="absolute top-1 right-1 z-10 bg-[var(--bg-cream)]/90 backdrop-blur-md text-[var(--text-espresso)] text-[8px] font-bold px-1 rounded shadow-sm border border-[var(--border-light)] flex items-center gap-1">
             Hiatus
          </div>
        )}
      </div>
    );
  };

  const renderMonthlyCalendar = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const today = new Date();
    
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
      <div className="bg-[var(--card-bg)] rounded-3xl p-4 md:p-6 shadow-xl border-2 border-[var(--border-light)] transition-colors duration-500">
        <div className="flex justify-between items-center mb-6 px-2 md:px-4">
          <h2 className="text-2xl md:text-3xl font-black text-[var(--text-espresso)] transition-colors duration-500">
            {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' })} {currentYear}
          </h2>
          <div className="flex gap-2">
            <button 
              className="p-2 md:p-3 bg-[var(--bg-cream)] hover:bg-[var(--border-light)] rounded-full text-[var(--text-espresso)] transition-all duration-300 ease-out active:scale-95"
              onClick={() => setCurrentMonth(p => p === 0 ? 11 : p - 1)}
            >
              <ChevronLeft size={20} className="md:w-6 md:h-6" />
            </button>
            <button 
              className="p-2 md:p-3 bg-[var(--bg-cream)] hover:bg-[var(--border-light)] rounded-full text-[var(--text-espresso)] transition-all duration-300 ease-out active:scale-95"
              onClick={() => setCurrentMonth(p => p === 11 ? 0 : p + 1)}
            >
              <ChevronRight size={20} className="md:w-6 md:h-6" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-4 text-center">
          {daysOfWeek.map(day => (
            <div key={day} className="font-bold text-[var(--text-espresso)]/60 text-xs md:text-base pb-2 truncate transition-colors duration-500">{day.substring(0,3)}</div>
          ))}
          
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="h-16 md:h-32 bg-transparent rounded-2xl" />;
            
            const cellDate = new Date(currentYear, currentMonth, day);
            const isToday = cellDate.toDateString() === today.toDateString();
            const cellDayOfWeek = cellDate.getDay();

            const dailyShows = activeScheduled.filter(a => {
              const targetTs = isAnime ? a.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[a.id], currentTime);
              if (!targetTs || targetTs === 'HIATUS') return false;
              
              const showLocalDay = new Date(targetTs * 1000).getDay();
              if (showLocalDay !== cellDayOfWeek) return false;

              const remaining = (a.totalEpisodes && a.nextEpisodeNumber) ? a.totalEpisodes - a.nextEpisodeNumber : 12;
              const endDate = new Date((targetTs * 1000) + (remaining * 7 * 24 * 60 * 60 * 1000));
              
              const strictCellDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
              const strictEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
              
              return strictCellDate <= strictEndDate;
            });

            return (
              <div 
                key={day} 
                className={`h-16 md:h-32 rounded-xl md:rounded-2xl p-1 md:p-2 border-2 transition-all duration-300 ease-out cursor-pointer relative group flex flex-wrap gap-1 content-start ${
                  isToday 
                    ? `bg-[var(--bg-cream)] border-[var(--text-espresso)]/20` 
                    : 'bg-[var(--bg-cream)] border-transparent hover:border-[var(--border-med)]'
                }`}
                onClick={() => setSelectedScheduleDate(cellDate)}
              >
                <span className={`font-bold text-xs md:text-sm w-full text-left pl-1 mb-1 transition-colors duration-500 ${isToday ? accentText : 'text-[var(--text-espresso)]'}`}>
                  {day} {isToday && <span className={`inline-block w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${accentColor} animate-pulse ml-1`} />}
                </span>
                
                {dailyShows.slice(0,4).map(show => (
                  <img 
                    key={show.id} 
                    src={show.image} 
                    className="w-4 h-4 md:w-8 md:h-8 rounded md:rounded-md object-cover shadow-sm group-hover:scale-110 transition-transform duration-300" 
                    title={show.title}
                    alt=""
                  />
                ))}
                {dailyShows.length > 4 && (
                  <div className="w-4 h-4 md:w-8 md:h-8 rounded md:rounded-md bg-[var(--card-bg)] border border-[var(--border-light)] flex items-center justify-center text-[8px] md:text-[10px] font-bold text-[var(--text-espresso)] transition-colors duration-500">
                    +{dailyShows.length - 4}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-espresso)] font-sans selection:bg-[var(--accent-matcha)] selection:text-white pb-20 transition-colors duration-500">
      
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-green-400" />
          <span className="font-bold text-sm">Schedule copied!</span>
        </div>
      )}

      <header className="bg-[var(--card-bg)] sticky top-0 z-50 border-b border-[var(--border-light)] shadow-sm px-4 md:px-8 py-4 transition-colors duration-500 ease-out">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex justify-between items-center w-full relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl shadow-sm transition-all duration-300 ease-out overflow-hidden flex items-center justify-center relative">
                <img src="./icon-192.png" alt="AniDrop Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight leading-none transition-colors duration-500">AniDrop</h1>
                <p className="text-[10px] md:text-xs font-semibold opacity-60 transition-colors duration-500">
                  {isAnime ? 'Live Episode Tracker' : 'Manga Library & Tracker'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <button 
                onClick={() => setShowShareCard(true)}
                className="p-2 md:p-2.5 rounded-full hover:bg-[var(--bg-cream)] text-[var(--text-espresso)] transition-all duration-300 ease-out active:scale-95"
                title="Share Stats"
              >
                <Share2 size={18} className="md:w-5 md:h-5" />
              </button>
              
              {/* THE NEW NOTIFICATION BELL & DROPDOWN */}
              <div className="relative">
                <button 
                  onClick={() => { setIsNotifMenuOpen(!isNotifMenuOpen); markAllNotifsRead(); }}
                  className="p-2 md:p-2.5 rounded-full hover:bg-[var(--bg-cream)] text-[var(--text-espresso)] transition-all duration-300 ease-out active:scale-95 relative"
                  title="Notifications"
                >
                  <Bell size={18} className="md:w-5 md:h-5" fill={unreadNotifCount > 0 ? "currentColor" : "none"} />
                  {unreadNotifCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-[var(--card-bg)] rounded-full animate-pulse"></span>
                  )}
                </button>

                {isNotifMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-[85vw] max-w-sm bg-[var(--bg-main)] border-2 border-[var(--border-med)] rounded-2xl shadow-2xl z-[200] overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--card-bg)]">
                      <h3 className="font-black text-[var(--text-espresso)] flex items-center gap-2">
                        <Bell size={18} /> Alerts Tray
                      </h3>
                      <button onClick={() => setIsNotifMenuOpen(false)} className="text-[var(--text-espresso)]/60 hover:text-[var(--text-espresso)]"><X size={18}/></button>
                    </div>
                    
                    <div className="p-3 bg-[var(--bg-cream)] border-b border-[var(--border-light)] flex justify-between items-center shrink-0">
                      <span className="text-xs font-bold text-[var(--text-espresso)]/80">Desktop OS Alerts</span>
                      <button onClick={toggleOSNotifs} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${notifsEnabled ? 'bg-green-500 text-white shadow-sm' : 'bg-[var(--border-med)] text-[var(--text-espresso)]'}`}>
                        {notifsEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2 space-y-2">
                      {notifications.length === 0 ? (
                        <div className="p-6 flex flex-col items-center text-center text-[var(--text-espresso)]/40 gap-2">
                          <Inbox size={32} />
                          <p className="text-sm font-bold">No new drops yet!</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className={`p-3 rounded-xl border flex gap-3 items-center transition-colors duration-300 ${n.read ? 'bg-[var(--card-bg)] border-[var(--border-light)] opacity-70' : 'bg-[var(--bg-cream)] border-[var(--accent-matcha)] shadow-md'}`}>
                            <img src={n.image} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[var(--text-espresso)] truncate leading-tight mb-0.5">{n.title}</p>
                              <p className="text-xs font-mono font-bold text-[var(--text-espresso)]/70">{n.message}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {notifications.length > 0 && (
                      <button onClick={clearNotifs} className="p-3 text-center text-xs font-bold text-[var(--text-espresso)]/60 hover:text-[var(--text-espresso)] hover:bg-[var(--bg-cream)] bg-[var(--card-bg)] border-t border-[var(--border-light)] w-full transition-colors shrink-0">
                        Clear Tray
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 md:p-2.5 rounded-full hover:bg-[var(--bg-cream)] text-[var(--text-espresso)] transition-all duration-300 ease-out active:scale-95"
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun size={18} className="md:w-5 md:h-5" /> : <Moon size={18} className="md:w-5 md:h-5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto">
              <div className="flex bg-[var(--bg-cream)] p-1 rounded-full border border-[var(--border-light)] shadow-inner w-full md:w-auto justify-center transition-colors duration-500">
                <button 
                  onClick={() => setMediaMode('anime')}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all duration-300 ease-out active:scale-95 ${
                    isAnime ? 'bg-[var(--accent-matcha)] text-white shadow-md' : 'text-[var(--text-espresso)]/60 hover:text-[var(--text-espresso)]'
                  }`}
                >
                  <MonitorPlay size={16} /> Anime
                </button>
                <button 
                  onClick={() => setMediaMode('manga')}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all duration-300 ease-out active:scale-95 ${
                    !isAnime ? 'bg-[var(--accent-taro)] text-white shadow-md' : 'text-[var(--text-espresso)]/60 hover:text-[var(--text-espresso)]'
                  }`}
                >
                  <BookOpen size={16} /> Manga
                </button>
              </div>
              
              <div className="relative w-full lg:w-[400px] mt-3 md:mt-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-espresso)]/40 transition-colors duration-500" size={20} />
                <input 
                  type="text" 
                  placeholder={`Search ${isAnime ? 'airing anime' : 'publishing manga'}...`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`w-full bg-[var(--bg-cream)] border-2 border-[var(--border-light)] rounded-2xl py-2.5 pl-12 pr-4 text-[var(--text-espresso)] font-medium outline-none transition-all duration-300 ease-out placeholder:text-[var(--text-espresso)]/40 shadow-inner ${ringAccent}`}
                />
              </div>
            </div>

            <div className="flex bg-[var(--bg-cream)] p-1 rounded-full border border-[var(--border-light)] shadow-inner w-full lg:w-auto overflow-x-auto hide-scrollbar transition-colors duration-500">
              <button 
                onClick={() => setViewMode('dashboard')}
                className={`flex-1 lg:flex-none flex items-center justify-center whitespace-nowrap gap-2 px-4 py-2 rounded-full font-bold text-xs md:text-sm transition-all duration-300 ease-out active:scale-95 ${
                  viewMode === 'dashboard' ? `${accentColor} text-white shadow-md` : 'text-[var(--text-espresso)]/60 hover:text-[var(--text-espresso)]'
                }`}
              >
                <LayoutDashboard size={16} /> <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button 
                onClick={() => setViewMode('weekly')}
                className={`flex-1 lg:flex-none flex items-center justify-center whitespace-nowrap gap-2 px-4 py-2 rounded-full font-bold text-xs md:text-sm transition-all duration-300 ease-out active:scale-95 ${
                  viewMode === 'weekly' ? `${accentColor} text-white shadow-md` : 'text-[var(--text-espresso)]/60 hover:text-[var(--text-espresso)]'
                }`}
              >
                <CalendarDays size={16} /> <span className="hidden sm:inline">Full Week</span>
              </button>
              <button 
                onClick={() => setViewMode('planner')}
                className={`flex-1 lg:flex-none flex items-center justify-center whitespace-nowrap gap-2 px-4 py-2 rounded-full font-bold text-xs md:text-sm transition-all duration-300 ease-out active:scale-95 ${
                  viewMode === 'planner' ? `${accentColor} text-white shadow-md` : 'text-[var(--text-espresso)]/60 hover:text-[var(--text-espresso)]'
                }`}
              >
                <CalendarIcon size={16} /> <span className="hidden sm:inline">Desk Planner</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-6 md:pt-8">
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 md:mb-4 hide-scrollbar">
          {activePlatforms.map(platform => (
            <button
              key={platform}
              onClick={() => setPlatformFilter(platform)}
              className={`px-4 py-2 rounded-full font-bold text-xs md:text-sm whitespace-nowrap border-2 transition-all duration-300 ease-out active:scale-95 ${
                platformFilter === platform
                  ? `${accentColor} border-transparent text-white shadow-md`
                  : 'bg-[var(--card-bg)] border-[var(--border-light)] text-[var(--text-espresso)] hover:border-[var(--border-med)]'
              }`}
            >
              {platform}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border-2 border-red-500/20 text-red-500 p-4 rounded-2xl mb-6 md:mb-8 flex items-center gap-3 font-bold shadow-sm text-sm md:text-base">
            <AlertTriangle size={20} className="shrink-0" /> {errorMsg}
          </div>
        )}

        {viewMode === 'planner' ? (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {renderMonthlyCalendar()}
            {selectedScheduleDate && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setSelectedScheduleDate(null)}>
                <div className="bg-[var(--bg-main)] p-6 rounded-3xl w-full max-w-md shadow-2xl border-2 border-[var(--border-light)] transition-colors duration-500" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-[var(--text-espresso)]">
                      {selectedScheduleDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h3>
                    <button onClick={() => setSelectedScheduleDate(null)} className="p-2 hover:bg-[var(--border-light)] rounded-full text-[var(--text-espresso)] transition-colors duration-300 active:scale-95"><X size={20}/></button>
                  </div>
                  
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                    {activeScheduled.filter(a => {
                      const targetTs = isAnime ? a.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[a.id], currentTime);
                      if (!targetTs || targetTs === 'HIATUS') return false;
                      return new Date(targetTs * 1000).getDay() === selectedScheduleDate.getDay();
                    }).map(show => {
                      let targetTs = isAnime ? show.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[show.id], currentTime);
                      const dismissId = `${show.id}-${targetTs}`;
                      let timeText = formatTimeRemaining(targetTs, currentTime);
                      if (dismissedDrops.includes(dismissId)) timeText = 'Skipped this week';
                      
                      return (
                        <div key={show.id} className="bg-[var(--card-bg)] p-3 rounded-2xl border border-[var(--border-light)] flex gap-4 items-center cursor-pointer hover:border-[var(--border-med)] transition-colors duration-300" onClick={() => { setSelectedScheduleDate(null); setDetailsMedia(show); }}>
                          <img src={show.image} className="w-12 h-12 rounded-xl object-cover shrink-0" alt="" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-[var(--text-espresso)] line-clamp-1 text-sm md:text-base">{show.title}</h4>
                            <p className={`text-xs font-mono font-bold truncate ${timeText === 'Out Now!' ? accentText : 'text-[var(--text-espresso)]/60'}`}>
                              {timeText}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : viewMode === 'weekly' ? (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl md:text-2xl font-black text-[var(--text-espresso)] mb-4 md:mb-6 flex items-center gap-3 transition-colors duration-500">
              <CalendarDays className={accentText} /> Full Week Schedule
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
              {daysOfWeek.map((dayName, idx) => (
                <div key={dayName} className="bg-[var(--card-bg)] rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-sm border border-[var(--border-light)] flex flex-col gap-3 min-h-[250px] transition-colors duration-500">
                  <div className="text-center pb-2 border-b border-[var(--border-light)]">
                    <h3 className="font-bold text-[var(--text-espresso)] text-sm md:text-base">{dayName.substring(0, 3)} <span className="hidden md:inline">{dayName.substring(3)}</span></h3>
                    {idx === new Date().getDay() && (
                      <span className={`text-[8px] md:text-[10px] font-black ${accentColor} text-white px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-wider`}>
                        Today
                      </span>
                    )}
                  </div>
                  
                  {mediaByDay[idx].length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-[var(--text-espresso)]/20">
                      <Inbox size={24} />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 md:gap-3">
                      {mediaByDay[idx].map(media => (
                        <React.Fragment key={media.id}>
                          {renderMiniCard(media)}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section>
              <h2 className="text-xl md:text-2xl font-black text-[var(--text-espresso)] mb-4 md:mb-6 flex items-center gap-3 transition-colors duration-500">
                <CheckCircle2 className={accentText} /> {isAnime ? 'My Board' : 'Reading List'}
              </h2>
              {activePinned.length === 0 && (!isAnime ? Object.keys(mangaSchedules).length === 0 : scheduledAnime.length === 0) ? (
                <div className="bg-[var(--card-bg)] rounded-3xl p-8 md:p-12 text-center shadow-sm border-2 border-dashed border-[var(--border-med)] flex flex-col items-center justify-center gap-4 transition-colors duration-500">
                  <Search size={40} className="text-[var(--text-espresso)]/20 md:w-12 md:h-12" />
                  <p className="text-[var(--text-espresso)]/60 font-medium text-sm md:text-base max-w-sm">
                    Your board is empty! Search for an anime or manga above to start your list.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6 items-start">
                  {activePinned.map(media => <React.Fragment key={media.id}>{renderCard(media)}</React.Fragment>)}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-black text-[var(--text-espresso)] mb-4 md:mb-6 flex items-center gap-3 transition-colors duration-500">
                <CalendarIcon className={accentText} /> {isAnime ? 'Weekly Menu' : 'Release Schedule'}
              </h2>
              
              <div className="flex gap-2 md:gap-3 overflow-x-auto pb-4 mb-2 hide-scrollbar">
                {daysOfWeek.map((day, idx) => {
                  const isToday = new Date().getDay() === idx;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(idx)}
                      className={`relative px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all duration-300 ease-out whitespace-nowrap shadow-sm border-2 active:scale-95 ${
                        selectedDay === idx 
                          ? `${accentColor} text-white border-transparent scale-105` 
                          : 'bg-[var(--card-bg)] text-[var(--text-espresso)] border-[var(--border-light)] hover:border-[var(--border-med)]'
                      }`}
                    >
                      {day}
                      {isToday && (
                        <span className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full absolute -top-1 -right-1 shadow-sm ${
                          selectedDay === idx ? 'bg-white' : accentColor
                        } animate-pulse`} />
                      )}
                    </button>
                  );
                })}
              </div>

              {mediaByDay[selectedDay].length === 0 ? (
                <div className="bg-[var(--card-bg)] rounded-3xl p-8 md:p-12 text-center shadow-sm border-2 border-dashed border-[var(--border-med)] flex flex-col items-center justify-center gap-4 transition-colors duration-500">
                  <Inbox size={40} className="text-[var(--text-espresso)]/20 md:w-12 md:h-12" />
                  <p className="text-[var(--text-espresso)]/60 font-medium text-sm md:text-lg">No fresh drops scheduled for today.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6 items-start animate-in slide-in-from-left-4 duration-300">
                  {mediaByDay[selectedDay].map(media => <React.Fragment key={media.id}>{renderCard(media)}</React.Fragment>)}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-black text-[var(--text-espresso)] mb-4 md:mb-6 flex items-center gap-3 transition-colors duration-500">
                <MonitorPlay className={accentText} /> 
                {debouncedQuery ? `Search Results for "${debouncedQuery}"` : (isAnime ? 'Top Fresh Drops' : 'Top Publishing Manga')}
              </h2>
              
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6 items-start">
                  {[...Array(10)].map((_, i) => <SkeletonCard isAnime={isAnime} key={i}/>)}
                </div>
              ) : filteredMedia.length === 0 && !errorMsg ? (
                <div className="bg-[var(--card-bg)] rounded-3xl p-8 md:p-12 text-center shadow-sm border-2 border-dashed border-[var(--border-med)] transition-colors duration-500">
                  <p className="text-[var(--text-espresso)]/60 font-medium text-xl md:text-2xl mb-2">( ´ ▽ ` )</p>
                  <p className="text-[var(--text-espresso)]/60 font-medium text-sm md:text-base">No results found for "{debouncedQuery}"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6 items-start">
                  {filteredMedia.map(media => (
                    <React.Fragment key={media.id}>{renderCard(media)}</React.Fragment>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <DetailsModal 
          media={detailsMedia}
          onClose={() => setDetailsMedia(null)}
          onZen={() => setZenModeMedia(detailsMedia)}
          isAnime={isAnime}
          accentColor={accentColor}
          isPinned={detailsMedia ? activePinned.some(p => p.id === detailsMedia.id) : false}
          isScheduled={detailsMedia ? (isAnime ? scheduledAnime.some(s => s.id === detailsMedia.id) : !!mangaSchedules[detailsMedia.id]) : false}
          onPin={(e) => togglePin(detailsMedia, e)}
          onSchedule={(e) => toggleSchedule(detailsMedia, e)}
        />

        {showShareCard && (
          <ShareCardModal 
            onClose={() => setShowShareCard(false)}
            activePinned={activePinned}
            isAnime={isAnime}
            mediaProgress={mediaProgress}
            mediaByDay={mediaByDay}
            mangaSchedules={mangaSchedules}
            currentTime={currentTime}
          />
        )}

        {scheduleModalMedia && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setScheduleModalMedia(null)}>
            <div className="bg-[var(--bg-main)] p-6 md:p-8 rounded-3xl w-full max-w-sm shadow-2xl border-2 border-[var(--border-light)] transition-colors duration-500 max-h-[85vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-black text-[var(--text-espresso)] mb-2 text-center">Set Drop Time</h3>
              <p className="text-sm text-[var(--text-espresso)]/60 text-center mb-6 line-clamp-1">{scheduleModalMedia.title}</p>
              
              <div className="space-y-4 mb-8 relative">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-espresso)]/80 mb-2 uppercase">Day of the week</label>
                  <DayDropdown onChange={setScheduleDay} value={scheduleDay} disabled={customHiatus} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-espresso)]/80 mb-2 uppercase">Time (24H)</label>
                  <div className={`flex items-center gap-4 w-full transition-opacity duration-300 ${customHiatus ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input 
                      type="text" inputMode="numeric" pattern="[0-9]*" placeholder="12"
                      value={scheduleHour} 
                      onChange={(e) => { 
                        let val = e.target.value.replace(/\D/g, ''); 
                        if (val !== '' && parseInt(val) > 23) val = '23'; 
                        setScheduleHour(val); 
                      }}
                      className="flex-1 w-full text-center p-3 bg-transparent border-2 border-[var(--border-med)] rounded-xl outline-none focus:border-[var(--accent-taro)] text-xl font-bold text-[var(--text-espresso)] appearance-none transition-colors"
                    />
                    <span className="text-2xl font-black text-[var(--text-espresso)]/40">:</span>
                    <input 
                      type="text" inputMode="numeric" pattern="[0-9]*" placeholder="00"
                      value={scheduleMinute} 
                      onChange={(e) => { 
                        let val = e.target.value.replace(/\D/g, ''); 
                        if (val !== '' && parseInt(val) > 59) val = '59'; 
                        setScheduleMinute(val); 
                      }}
                      className="flex-1 w-full text-center p-3 bg-transparent border-2 border-[var(--border-med)] rounded-xl outline-none focus:border-[var(--accent-taro)] text-xl font-bold text-[var(--text-espresso)] appearance-none transition-colors"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setCustomHiatus(!customHiatus)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-out relative ${customHiatus ? 'bg-[var(--accent-taro)]' : 'bg-[var(--border-med)]'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ease-out ${customHiatus ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-bold text-[var(--text-espresso)]">Mark as On Hiatus</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={saveMangaSchedule}
                  disabled={((scheduleDay === '' || scheduleHour === '' || scheduleMinute === '') && !customHiatus)}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 ease-out shadow-md active:scale-95 ${
                    ((scheduleDay === '' || scheduleHour === '' || scheduleMinute === '') && !customHiatus)
                      ? 'bg-[var(--border-med)] text-[var(--text-espresso)]/50 cursor-not-allowed active:scale-100'
                      : 'bg-[var(--accent-taro)] hover:bg-[var(--accent-taro)]/90 text-white hover:shadow-lg'
                  }`}
                >
                  <CheckCircle2 size={18} /> Save Schedule
                </button>
                {mangaSchedules[scheduleModalMedia.id] && (
                  <button 
                    onClick={handleRemoveMangaSchedule}
                    className="w-full py-2 bg-transparent hover:bg-red-500/10 text-red-500 rounded-xl font-bold transition-colors duration-300 text-sm active:scale-95"
                  >
                    Remove Schedule
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {zenModeMedia && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-black text-white animate-in fade-in duration-700">
            <img 
              src={zenModeMedia.image} 
              alt="" 
              className={`fixed inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-110 pointer-events-none ${zenModeMedia.isStale ? 'grayscale' : ''}`} 
            />
            
            <button 
              onClick={() => setZenModeMedia(null)}
              className="fixed top-6 left-6 z-[110] bg-black/50 hover:bg-black/80 backdrop-blur-md p-3 rounded-full transition-all cursor-pointer shadow-xl hover:scale-110 active:scale-95"
              title="Back to Details"
            >
              <Minimize size={20} className="md:w-6 md:h-6 text-white" />
            </button>
            
            <div className="relative z-10 flex flex-col items-center pt-24 px-4 md:px-12 min-h-full">
              <img 
                src={zenModeMedia.image} 
                className={`h-64 md:h-[50vh] w-auto object-contain rounded-xl md:rounded-2xl shadow-2xl border border-white/20 mb-8 ${zenModeMedia.isStale ? 'opacity-90 grayscale-[20%]' : ''}`} 
                alt={zenModeMedia.title}
              />
              
              <p className={`text-[10vw] md:text-[6vw] font-mono font-black tracking-tighter drop-shadow-2xl mb-4 leading-none text-center ${
                (() => {
                  let targetTs = isAnime ? zenModeMedia.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[zenModeMedia.id], currentTime);
                  const dismissId = `${zenModeMedia.id}-${targetTs}`;
                  let timeText = formatTimeRemaining(targetTs, currentTime);
                  if (dismissedDrops.includes(dismissId)) timeText = 'Skipped this week';
                  return timeText === 'Out Now!' ? 'text-[var(--accent-matcha)] animate-pulse' : 'text-white';
                })()
              }`}>
                {(() => {
                  let targetTs = isAnime ? zenModeMedia.nextEpisodeTimestamp : getNextMangaTimestamp(mangaSchedules[zenModeMedia.id], currentTime);
                  const dismissId = `${zenModeMedia.id}-${targetTs}`;
                  let timeText = formatTimeRemaining(targetTs, currentTime);
                  if (dismissedDrops.includes(dismissId)) timeText = 'Skipped this week';
                  return timeText;
                })()}
              </p>
              
              <h2 className="text-3xl md:text-5xl font-extrabold text-white drop-shadow-lg mb-8 text-center max-w-4xl line-clamp-2 md:line-clamp-none">
                {zenModeMedia.title}
              </h2>
              
              <div 
                className="max-w-4xl mx-auto text-lg/relaxed opacity-90 pb-20"
                dangerouslySetInnerHTML={{ __html: zenModeMedia.description ? DOMPurify.sanitize(zenModeMedia.description) : 'No synopsis available.' }}
              />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
