import { useEffect, useState, type RefObject } from 'react';
import { ArrowDown } from 'lucide-react';

export function JumpToDecision({ target }: { target: RefObject<HTMLElement> }) {
  const [targetVisible, setTargetVisible] = useState(false);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setTargetVisible(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, [target]);

  if (targetVisible) return null;
  return <button type="button" className="btn btn-primary aw-jump" onClick={() => {
    target.current?.scrollIntoView({ block: 'start' });
    target.current?.focus({ preventScroll: true });
  }}>
    <ArrowDown size={16} aria-hidden="true" /> Đến phần quyết định
  </button>;
}
