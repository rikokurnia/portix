"use client";
import { useEffect, useRef } from "react";
import { assets } from "@/lib/assets";
export function Background() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const v = ref.current;
      if (!v) return;
      if (media.matches) {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } else {
        v.src = assets.background;
        void v.play().catch(() => {});
      }
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <div
      className="world-background"
      aria-hidden="true"
      style={{ backgroundImage: `url(${assets.backgroundStill})` }}
    >
      <video
        ref={ref}
        muted
        autoPlay
        playsInline
        loop
        poster={assets.backgroundStill}
        onError={(e) => {
          e.currentTarget.style.visibility = "hidden";
        }}
      />
    </div>
  );
}
