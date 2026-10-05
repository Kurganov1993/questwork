'use client';

import { useRef, useState } from 'react';
import { gsap } from 'gsap';

export function MagneticButton({
  children,
  className = '',
  strength = 0.35,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  as?: 'div' | 'span';
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [reduce] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  function onMove(e: React.MouseEvent) {
    if (reduce) return;
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);

    gsap.to(el, {
      x: x * strength,
      y: y * strength,
      duration: 0.6,
      ease: 'power3.out',
    });
  }

  function onLeave() {
    if (reduce) return;
    const el = wrapperRef.current;
    if (!el) return;
    gsap.to(el, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.4)',
    });
  }

  const Tag = as;

  return (
    <Tag
      ref={wrapperRef as never}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`inline-block ${className}`}
      style={{ willChange: 'transform' }}
    >
      {children}
    </Tag>
  );
}