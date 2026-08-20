"use client";

import Image from "next/image";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils/cn";

/** Tilting is for pointer devices, and only for visitors who accept motion. */
const TILT_QUERY = "(hover: hover) and (prefers-reduced-motion: no-preference)";

function subscribeToTiltQuery(onChange: () => void): () => void {
  const query = window.matchMedia(TILT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useTiltEnabled(): boolean {
  return useSyncExternalStore(
    subscribeToTiltQuery,
    () => window.matchMedia(TILT_QUERY).matches,
    // The server cannot know: render the still model and upgrade on hydration.
    () => false,
  );
}

type FloatingModelProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Value for the `sizes` attribute — always set it, the model is large. */
  sizes: string;
  /** True for the model above the fold, false for anything below it. */
  priority?: boolean;
  /** Degrees of rotation at the edges of the frame. 0 disables the tilt. */
  maxTilt?: number;
  className?: string;
};

/**
 * A cut-out render presented as a physical model: it floats, it casts a contact
 * shadow, light pools behind it, and it turns towards the pointer. This is the
 * house on the home page and the ruin on the 404 — every 3D asset in the app
 * goes through here so the treatment stays identical.
 */
export function FloatingModel({
  src,
  alt,
  width,
  height,
  sizes,
  priority = false,
  maxTilt = 9,
  className,
}: FloatingModelProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const tiltEnabled = useTiltEnabled() && maxTilt > 0;

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!tiltEnabled || !frameRef.current) return;

      const bounds = frameRef.current.getBoundingClientRect();
      // -0.5 .. 0.5 relative to the centre of the frame.
      const dx = (event.clientX - bounds.left) / bounds.width - 0.5;
      const dy = (event.clientY - bounds.top) / bounds.height - 0.5;
      setTilt({ x: -dy * maxTilt * 2, y: dx * maxTilt * 2 });
    },
    [maxTilt, tiltEnabled],
  );

  const reset = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  return (
    <div
      ref={frameRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      className={cn("relative [perspective:1600px]", className)}
    >
      {/* Light pooling behind the model, so it does not float on flat paper. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-10%] top-[6%] h-[80%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(51,80,125,0.16),transparent)] blur-2xl"
      />

      <div
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
        className="relative transition-transform duration-500 ease-out [transform-style:preserve-3d] will-change-transform"
      >
        <div className="animate-float motion-reduce:animate-none">
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            sizes={sizes}
            className="h-auto w-full drop-shadow-[0_28px_45px_rgba(27,42,68,0.28)]"
          />
        </div>

        {/* Contact shadow: sits on the ground plane, not on the model. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-[12%] bottom-[2%] h-6 rounded-[50%] bg-ink-900/22 blur-xl"
        />
      </div>
    </div>
  );
}
