import { useMemo } from "react";
import { getRandomColor } from "@/utils/material3";
import { getRandomInt } from "@/utils/random";
import styles from "./styles.module.css";

const windowMin = Math.min(window.innerWidth, window.innerHeight);
const windowMax = Math.max(window.innerWidth, window.innerHeight);

const CIRCLE_COUNT = Math.floor(windowMax / 50); // More circles for larger screens
const CIRCLE_SIZE_RANGE: [number, number] = [100, 400];
const CIRCLE_SHADES: number[] = [300, 400, 500, 600];
const ANIMATION_DURATION_RANGE: [number, number] = [20, 40]; // seconds
const SCREEN_MIN = -50;
const SCREEN_MAX = 150;
console.log(`Generating ${CIRCLE_COUNT} background circles`); // Debug log to verify circle count

interface FloatingCircleProps {
  size: number;
  color: string;
}

function FloatingCircle({ size, color }: FloatingCircleProps) {
  // Generate random positions and duration once on mount
  const animationConfig = useMemo(
    () => ({
      fadeDuration: getRandomInt(
        ANIMATION_DURATION_RANGE[0] / 2,
        ANIMATION_DURATION_RANGE[1] / 2,
      ),
      fadeDelay: getRandomInt(0, ANIMATION_DURATION_RANGE[1] / 2),

      scaleDuration: getRandomInt(
        ANIMATION_DURATION_RANGE[0] / 2,
        ANIMATION_DURATION_RANGE[1] / 2,
      ),
      scaleDelay: getRandomInt(0, ANIMATION_DURATION_RANGE[1] / 2),

      startX: getRandomInt(SCREEN_MIN, SCREEN_MAX),
      startY: getRandomInt(SCREEN_MIN, SCREEN_MAX),
      endX: getRandomInt(SCREEN_MIN, SCREEN_MAX),
      endY: getRandomInt(SCREEN_MIN, SCREEN_MAX),
      slideDuration: getRandomInt(
        ANIMATION_DURATION_RANGE[0],
        ANIMATION_DURATION_RANGE[1],
      ),
      slideDelay: getRandomInt(0, ANIMATION_DURATION_RANGE[1] / 2),
    }),
    [],
  );

  return (
    <div
      className={styles.circle}
      style={{
        // @ts-expect-error -- CSS variables
        "--size": `${size}px`,
        "--color": color,

        "--fade-duration": `${animationConfig.fadeDuration}s`,
        "--fade-delay": `${animationConfig.fadeDelay}s`,

        "--scale-duration": `${animationConfig.scaleDuration}s`,
        "--scale-delay": `${animationConfig.scaleDelay}s`,

        "--slide-from-x": `${animationConfig.startX}vw`,
        "--slide-from-y": `${animationConfig.startY}vh`,
        "--slide-to-x": `${animationConfig.endX}vw`,
        "--slide-to-y": `${animationConfig.endY}vh`,
        "--slide-duration": `${animationConfig.slideDuration}s`,
        "--slide-delay": `${animationConfig.slideDelay}s`,
      }}
    />
  );
}

export function PageBackground({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.pageBackground}>
      <div className={styles.circlesContainer}>
        {new Array(CIRCLE_COUNT).fill(0).map((_, i) => (
          <FloatingCircle
            // biome-ignore lint/suspicious/noArrayIndexKey: simple static array for background circles, no reordering or dynamic changes expected
            key={i}
            size={getRandomInt(CIRCLE_SIZE_RANGE[0], CIRCLE_SIZE_RANGE[1])}
            color={getRandomColor(
              CIRCLE_SHADES[getRandomInt(0, CIRCLE_SHADES.length - 1)],
            )}
          />
        ))}
      </div>
      <div className={styles.contentContainer}>{children}</div>
    </main>
  );
}
