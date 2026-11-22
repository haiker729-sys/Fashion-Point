import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { ANNOUNCEMENT_MESSAGES } from '../../data/catalog';
import { useRouter } from '../../router/RouterContext';

export const AnnouncementBar: React.FC = () => {
  const { navigate } = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (paused || dismissed) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % ANNOUNCEMENT_MESSAGES.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [paused, dismissed]);

  if (dismissed) return null;

  const handleAction = () => {
    if (index === 2) {
      navigate('/showroom');
    } else {
      navigate('/offers');
    }
  };

  return (
    <div
      role="region"
      aria-label="Store announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="bg-[#151320] text-[#FFF8EF] border-b border-white/10"
    >
      <div className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8 h-9 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() =>
            setIndex((prev) => (prev - 1 + ANNOUNCEMENT_MESSAGES.length) % ANNOUNCEMENT_MESSAGES.length)
          }
          aria-label="Previous announcement"
          className="hidden sm:inline-flex h-6 w-6 items-center justify-center rounded text-[#FFF8EF]/65 hover:text-[#FFA94D] cursor-pointer shrink-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={handleAction}
          className="flex-1 min-w-0 flex items-center justify-center gap-2 text-center text-[11px] sm:text-xs font-medium text-[#FFF8EF]/92 hover:text-[#FFA94D] transition-colors cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#FFA94D] shrink-0 hidden xs:inline" aria-hidden="true" />
          <span key={index} className="truncate fw-animate-fade">
            {ANNOUNCEMENT_MESSAGES[index]}
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIndex((prev) => (prev + 1) % ANNOUNCEMENT_MESSAGES.length)}
            aria-label="Next announcement"
            className="hidden sm:inline-flex h-6 w-6 items-center justify-center rounded text-[#FFF8EF]/65 hover:text-[#FFA94D] cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss announcement bar"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-[#FFF8EF]/55 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
