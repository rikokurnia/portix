"use client";
import { useEffect, useRef } from "react";
import styles from "./landing.module.css";

export function LandingBackground() {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const element = video.current;
      if (!element) return;
      if (media.matches) {
        element.pause();
        element.removeAttribute("src");
        element.load();
        element.style.visibility = "hidden";
      } else {
        element.style.visibility = "visible";
        element.src = "/assets/video-bg.mp4";
        void element.play().catch(() => { element.style.visibility = "hidden"; });
      }
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return <div className={styles.background} aria-hidden="true">
    <video ref={video} muted loop playsInline autoPlay tabIndex={-1} poster="/assets/landing-poster.jpg"
      onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
  </div>;
}
