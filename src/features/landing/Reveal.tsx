"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import styles from "./reveal.module.css";

/** Each mounted group reveals once; scrolling back never hides it again. */
export function Reveal({ children, delay = 0, className = "" }: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        element.dataset.visible = "true";
        observer.disconnect();
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -32px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`${styles.reveal} ${className}`} data-visible="false"
    style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>{children}</div>;
}
