'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function HomeAnimations() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (typeof window === 'undefined') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      // ---- Общая история появления секций ----
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            once: true,
          },
          y: 40,
          opacity: 0,
          duration: 1,
          ease: 'expo.out',
        });
      });

      // ---- Каскадное появление карточек квестов ----
      gsap.utils.toArray<HTMLElement>('[data-cascade]').forEach((parent) => {
        const items = parent.querySelectorAll<HTMLElement>('[data-cascade-item]');
        if (items.length === 0) return;

        gsap.from(items, {
          scrollTrigger: {
            trigger: parent,
            start: 'top 80%',
            once: true,
          },
          y: 50,
          opacity: 0,
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.12,
        });
      });

      // ---- Parallax орбов в hero ----
      gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
        const speed = Number(el.dataset.parallaxSpeed ?? 0.4);
        gsap.to(el, {
          scrollTrigger: {
            trigger: 'body',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
          yPercent: -30 * speed,
          ease: 'none',
        });
      });

      // ---- Подиум выезжает ----
      const podium = document.querySelector('[data-podium]');
      if (podium) {
        gsap.from(podium.querySelectorAll('[data-podium-step]'), {
          scrollTrigger: {
            trigger: podium,
            start: 'top 75%',
            once: true,
          },
          scaleY: 0,
          transformOrigin: 'bottom',
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.15,
        });

        gsap.from(podium.querySelectorAll('[data-podium-avatar]'), {
          scrollTrigger: {
            trigger: podium,
            start: 'top 75%',
            once: true,
          },
          y: -40,
          opacity: 0,
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.15,
          delay: 0.3,
        });
      }

      // ---- Пульсация свечения в финальном CTA ----
      gsap.utils.toArray<HTMLElement>('[data-glow]').forEach((el) => {
        gsap.to(el, {
          scale: 1.15,
          opacity: 0.8,
          duration: 3,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });
    },
    { scope },
  );

  return <div ref={scope} aria-hidden="true" />;
}