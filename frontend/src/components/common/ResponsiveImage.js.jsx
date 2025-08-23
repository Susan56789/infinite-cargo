// src/components/common/ResponsiveImage.js
import React from 'react';

const ResponsiveImage = ({ 
  src, 
  alt, 
  className = '', 
  lazy = true,
  sizes = '100vw',
  priority = false
}) => {
  const baseName = src.replace(/\.[^/.]+$/, ""); // Remove extension
  const extension = src.split('.').pop();
  
  // Generate srcSet for different sizes
  const webpSrcSet = [
    `${baseName}-small.webp 400w`,
    `${baseName}-medium.webp 800w`, 
    `${baseName}-large.webp 1200w`,
    `${baseName}.webp 1920w`
  ].join(', ');
  
  const fallbackSrcSet = [
    `${baseName}-small.${extension} 400w`,
    `${baseName}-medium.${extension} 800w`,
    `${baseName}-large.${extension} 1200w`, 
    `${baseName}.${extension} 1920w`
  ].join(', ');

  return (
    <picture className={className}>
      {/* Modern browsers - WebP */}
      <source
        srcSet={webpSrcSet}
        sizes={sizes}
        type="image/webp"
      />
      
      {/* Fallback - JPEG/PNG */}
      <img
        src={`${baseName}.${extension}`}
        srcSet={fallbackSrcSet}
        sizes={sizes}
        alt={alt}
        loading={priority ? 'eager' : (lazy ? 'lazy' : 'eager')}
        decoding="async"
        className="max-w-full h-auto"
      />
    </picture>
  );
};

// Hero image component for above-the-fold content
export const HeroImage = ({ src, alt, className = '' }) => {
  return (
    <ResponsiveImage
      src={src}
      alt={alt}
      className={className}
      lazy={false}
      priority={true}
      sizes="100vw"
    />
  );
};

// Card image component for smaller images
export const CardImage = ({ src, alt, className = '' }) => {
  return (
    <ResponsiveImage
      src={src}
      alt={alt}
      className={className}
      lazy={true}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  );
};

// Thumbnail component for very small images
export const ThumbnailImage = ({ src, alt, className = '' }) => {
  const baseName = src.replace(/\.[^/.]+$/, "");
  const extension = src.split('.').pop();
  
  return (
    <img
      src={`${baseName}-small.${extension}`}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`max-w-full h-auto ${className}`}
    />
  );
};

export default ResponsiveImage;