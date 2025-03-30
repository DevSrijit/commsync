// EncapsulatedEmailContent component wraps the provided HTML in an isolated shadow DOM
// using the ShadowWrapper component. This prevents the email's styles from leaking out to the rest of the app.
'use client';

import React from 'react';
import ShadowWrapper from './shadow-wrapper';

interface EncapsulatedEmailContentProps {
  html: string;
  styleContent?: string; // Optional string for additional styles to inject in the shadow DOM
}

export default function EncapsulatedEmailContent({ html, styleContent }: EncapsulatedEmailContentProps) {
  return (
    <ShadowWrapper styleContent={styleContent}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </ShadowWrapper>
  );
} 