import { useEffect, useState } from 'react';
import { getTicketReviews, REVIEW_CHANGED_EVENT } from '../../api/reviewApi';

export default function useReviewCount(enabled, accountId, pathname) {
  const [count, setCount] = useState(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    setCount(null);
    if (!enabled) return undefined;
    const refresh = async () => {
      const current = ++generation;
      try {
        const data = await getTicketReviews({ status: 'pending' });
        if (active && current === generation) setCount(data.counts?.pending ?? data.total ?? 0);
      } catch {
        if (active && current === generation) setCount(null);
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener(REVIEW_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(REVIEW_CHANGED_EVENT, refresh);
    };
  }, [enabled, accountId, pathname]);
  return count;
}
