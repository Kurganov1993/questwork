'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

export function SplitHeroTitle() {
  const root = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      if (!root.current) return;

      const lines = root.current.querySelectorAll('[data-line]');
      const allChars: HTMLSpanElement[] = [];

      lines.forEach((line) => {
        const text = line.textContent ?? '';
        line.textContent = '';

        // Разбиваем на слова, чтобы переносы работали корректно
        text.split(' ').forEach((word, wi, arr) => {
          const wordEl = document.createElement('span');
          wordEl.style.display = 'inline-block';
          wordEl.style.whiteSpace = 'nowrap';

          word.split('').forEach((ch) => {
            const chEl = document.createElement('span');
            chEl.style.display = 'inline-block';
            chEl.style.willChange = 'transform, opacity';
            chEl.textContent = ch;
            wordEl.appendChild(chEl);
            allChars.push(chEl);
          });

          line.appendChild(wordEl);
          if (wi < arr.length - 1) {
            line.appendChild(document.createTextNode(' '));
          }
        });
      });

      gsap.from(allChars, {
        yPercent: 110,
        opacity: 0,
        rotateX: -40,
        duration: 1.1,
        ease: 'expo.out',
        stagger: {
          each: 0.02,
          from: 'start',
        },
        delay: 0.15,
      });
    },
    { scope: root },
  );

  return (
    <h1
      ref={root}
      className="text-5xl sm:text-7xl md:text-8xl font-bold leading-[0.95] mb-8"
    >
      <span data-line className="block text-zinc-100">
        Прокачай героя.
      </span>
      <span data-line className="block text-zinc-100">
        Победи босса.
      </span>
      <span data-line className="block text-gradient-amber">
        Получи работу.
      </span>
    </h1>
  );
}