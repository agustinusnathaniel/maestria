/// <reference types="astro/client" />

interface Window {
  umami?: {
    track: (event: string, data?: Record<string, string>) => void;
  };
}
