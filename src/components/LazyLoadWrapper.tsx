// src/components/LazyLoadWrapper.tsx
import React, { useState, ReactNode } from 'react';
import { useInView } from 'react-intersection-observer';

interface LazyLoadWrapperProps {
  children: ReactNode;
  // You can add placeholder styles or height if needed
  placeholderHeight?: string | number;
}

export default function LazyLoadWrapper({ children, placeholderHeight = '85vh' }: LazyLoadWrapperProps) {
  const { ref, inView } = useInView({
    triggerOnce: true, // Only trigger once to load the component
    rootMargin: '200px 0px 200px 0px', // Adjust margin as needed for pre-loading
  });

  return (
    // This div is tracked by the observer
    <div ref={ref} style={{ minHeight: placeholderHeight, width: '100%' }}>
      {/* Render the actual children only when in view */}
      {inView ? children : <div style={{ height: placeholderHeight, width: '100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#eee' }}><p>Loading...</p></div>}
    </div>
  );
}