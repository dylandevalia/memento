import { useEffect, useRef, useState } from "react";
import { IMAGE_LOADING } from "@/lib/constants";

/**
 * Custom hook for lazy loading images with Intersection Observer
 * @param rootMargin - Margin around the root element (default: "50px")
 * @param threshold - Threshold for intersection (default: 0.1)
 * @returns Ref to attach to the image element and loading state
 */
export function useLazyImage(
  rootMargin = IMAGE_LOADING.INTERSECTION_ROOT_MARGIN,
  threshold = IMAGE_LOADING.LAZY_LOAD_THRESHOLD,
) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const element = imgRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return {
    imgRef,
    isInView,
    isLoaded,
    handleLoad,
  };
}

/**
 * Hook to track which items in a list are visible
 * Useful for virtual scrolling or lazy loading lists
 * @returns Object with methods to register items and track visibility
 */
export function useVisibleItems() {
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleIndices((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!Number.isNaN(index)) {
              if (entry.isIntersecting) {
                next.add(index);
              } else {
                // Optional: remove from set when out of view to save memory
                // next.delete(index);
              }
            }
          }
          return next;
        });
      },
      {
        rootMargin: IMAGE_LOADING.INTERSECTION_ROOT_MARGIN,
        threshold: IMAGE_LOADING.LAZY_LOAD_THRESHOLD,
      },
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const registerItem = (element: HTMLElement | null, index: number) => {
    if (!element || !observerRef.current) return;
    element.setAttribute("data-index", index.toString());
    observerRef.current.observe(element);
  };

  const isVisible = (index: number) => visibleIndices.has(index);

  return {
    registerItem,
    isVisible,
    visibleIndices,
  };
}
