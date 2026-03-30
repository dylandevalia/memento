/**
 * Application-wide constants
 */

export const STORAGE_KEYS = {
  ADMIN_AUTH: "memento:admin:auth",
  UPLOADS: (slug: string) => `memento:uploads:${slug}`,
} as const;

export const LIMITS = {
  MAX_UPLOAD_SIZE: 2 * 1024 * 1024 * 1024, // 2 GB
  CONCURRENT_UPLOADS: 5,
  PROGRESS_THROTTLE_MS: 100,
} as const;

export const CUSTOM_EVENTS = {
  UPLOAD_COMPLETE: "memento-upload-complete",
} as const;

export const TIMEOUTS = {
  DELETE_ANIMATION_MS: 500,
  VALIDATION_DELAY_MS: 500,
  REQUEST_CACHE_TTL_MS: 5000,
} as const;

export const IMAGE_LOADING = {
  INTERSECTION_ROOT_MARGIN: "50px",
  LAZY_LOAD_THRESHOLD: 0.1,
} as const;
