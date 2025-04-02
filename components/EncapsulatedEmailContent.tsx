// EncapsulatedEmailContent component wraps the provided HTML in an isolated shadow DOM
// using the ShadowWrapper component. This prevents the email's styles from leaking out to the rest of the app.
'use client';

import React, { useMemo } from 'react';
import ShadowWrapper from './shadow-wrapper';

interface EncapsulatedEmailContentProps {
  html: string;
  styleContent?: string; // Optional string for additional styles to inject in the shadow DOM
}

export default function EncapsulatedEmailContent({ html, styleContent }: EncapsulatedEmailContentProps) {
  // Process HTML to remove duplicate content
  const processedHtml = useMemo(() => {
    if (!html) return '';

    // Create a DOM parser to analyze the HTML structure
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Function to get text content from HTML
    const getTextContent = (htmlString: string) => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlString;
      return tempDiv.textContent || '';
    };

    // Get the text content of the HTML
    const textContent = getTextContent(html);

    // Check for exact duplicated content
    if (textContent) {
      const halfLength = Math.floor(textContent.length / 2);
      const firstHalf = textContent.substring(0, halfLength).trim();
      const secondHalf = textContent.substring(halfLength).trim();

      // If the first half appears in the second half (accounting for some variance)
      if (firstHalf.length > 20 && secondHalf.includes(firstHalf)) {
        // Return only the first part of the HTML to prevent duplication
        const approxHalfHtmlLength = Math.floor(html.length / 2);
        return html.substring(0, approxHalfHtmlLength);
      }
    }

    // Check for repeated paragraphs - common in forwarded emails
    const paragraphs = doc.querySelectorAll('p, div');
    const uniqueParagraphs = new Set<string>();
    const duplicates = new Set<Element>();

    paragraphs.forEach((p) => {
      const content = p.textContent?.trim();
      if (content && content.length > 10) { // Only check substantial paragraphs
        if (uniqueParagraphs.has(content)) {
          duplicates.add(p);
        } else {
          uniqueParagraphs.add(content);
        }
      }
    });

    // If duplicates were found, remove them from HTML
    if (duplicates.size > 0) {
      duplicates.forEach(el => el.parentNode?.removeChild(el));
      return doc.body.innerHTML;
    }

    return html;
  }, [html]);

  return (
    <ShadowWrapper styleContent={styleContent}>
      <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
    </ShadowWrapper>
  );
} 