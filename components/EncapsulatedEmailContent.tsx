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

  // Enhanced mobile-responsive styles
  const mobileResponsiveStyles = `
    /* Base styles */
    * {
      max-width: 100%;
      box-sizing: border-box;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    /* Email body content */
    body, div, p, span, a, table, td, th, ul, ol, li, blockquote {
      max-width: 100% !important;
      margin: 0;
      padding: 0;
    }
    
    /* Links */
    a {
      word-break: break-word;
    }
    
    /* Images */
    img {
      height: auto !important;
      max-width: 100% !important;
      margin: 0 auto;
      display: block;
    }
    
    /* Tables - very common in emails */
    table {
      width: 100% !important;
      height: auto !important;
      table-layout: auto !important;
      border-collapse: collapse;
    }
    
    /* Table cells */
    th, td {
      word-break: break-word;
      padding: 8px !important;
    }
    
    /* Pre and code blocks */
    pre, code {
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
      overflow-x: auto;
      max-width: 100%;
      font-size: 0.9em;
    }
    
    /* Blockquotes */
    blockquote {
      margin: 8px 0 !important;
      padding: 8px 12px !important;
      border-left: 3px solid #e0e0e0;
    }
    
    /* Typography scaling */
    h1 { font-size: 1.4em !important; }
    h2 { font-size: 1.3em !important; }
    h3 { font-size: 1.2em !important; }
    h4, h5, h6 { font-size: 1.1em !important; }
    p, li { font-size: 0.95em !important; line-height: 1.5 !important; }
    
    /* Fix Gmail quote collapse */
    .gmail_quote {
      display: block !important;
    }
    
    /* Responsive design utility */
    @media screen and (max-width: 600px) {
      table, tr, td {
        width: 100% !important;
        display: block !important;
      }
      
      .mobile-hidden {
        display: none !important;
      }
      
      /* Further reduce font size on very small screens */
      body, p, div, span, li, a {
        font-size: 14px !important;
      }
    }
  `;

  // Combine custom styles with responsive styles
  const combinedStyles = styleContent
    ? `${mobileResponsiveStyles}\n${styleContent}`
    : mobileResponsiveStyles;

  return (
    <ShadowWrapper styleContent={combinedStyles}>
      <div className="email-content" dangerouslySetInnerHTML={{ __html: processedHtml }} />
    </ShadowWrapper>
  );
} 