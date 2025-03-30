// ShadowWrapper component to isolate inner content with a shadow DOM
// This helps to encapsulate email styles inside a Faraday cage, preventing leaking to the rest of the app.
'use client';

import { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

interface ShadowWrapperProps {
  children: React.ReactNode;
  styleContent?: string;
}

export default function ShadowWrapper({ children, styleContent }: ShadowWrapperProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
  const hasAttached = useRef(false);

  // Attach shadow root only once on mount using a ref guard
  useEffect(() => {
    const host = hostRef.current;
    if (host && !hasAttached.current) {
      if (!host.shadowRoot) {
        try {
          const shadow = host.attachShadow({ mode: 'open' });
          setShadowRoot(shadow);
          if (styleContent) {
            const styleEl = document.createElement('style');
            styleEl.textContent = styleContent;
            shadow.appendChild(styleEl);
          }
        } catch (error) {
          console.error('attachShadow error:', error);
        }
      } else {
        setShadowRoot(host.shadowRoot);
      }
      hasAttached.current = true;
    }
  }, []);

  // Update style content if it changes
  useEffect(() => {
    if (shadowRoot && styleContent) {
      let styleEl = shadowRoot.querySelector('style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        shadowRoot.appendChild(styleEl);
      }
      styleEl.textContent = styleContent;
    }
  }, [shadowRoot, styleContent]);

  return <div ref={hostRef}>{shadowRoot && ReactDOM.createPortal(children, shadowRoot)}</div>;
} 