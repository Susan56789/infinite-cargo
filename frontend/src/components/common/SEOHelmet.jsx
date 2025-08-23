// src/components/common/SEOHelmet.js
import { Helmet } from 'react-helmet-async';

const SEOHelmet = ({ title, description, keywords, canonicalUrl, noIndex = false }) => {
  const defaultTitle = "Infinite Cargo - Kenya's Leading Transport Network";
  const defaultDescription = "Connect cargo owners and drivers across Kenya. Post loads, find drivers, and transport goods efficiently with Infinite Cargo's trusted platform.";
  const defaultKeywords = "cargo transport Kenya, truck drivers Kenya, freight transport, logistics Kenya, cargo delivery, transport services";
  
  const finalTitle = title ? `${title} | Infinite Cargo` : defaultTitle;
  const finalDescription = description || defaultDescription;
  const finalKeywords = keywords || defaultKeywords;
  const finalCanonicalUrl = canonicalUrl || "https://infinitecargo.co.ke";

  return (
    <Helmet>
      {/* Essential Meta Tags - Only one of each */}
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords} />
      
      {/* Robots meta tag */}
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />
      
      {/* Author and viewport - only set once */}
      <meta name="author" content="Infinite Cargo" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={finalCanonicalUrl} />
      <meta property="og:image" content="https://infinitecargo.co.ke/images/og-image.jpg" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Infinite Cargo - Kenya's Leading Transport Network" />
      <meta property="og:site_name" content="Infinite Cargo" />
      <meta property="og:locale" content="en_KE" />
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content="https://infinitecargo.co.ke/images/twitter-card.jpg" />
      <meta name="twitter:image:alt" content="Infinite Cargo - Transport Solutions" />
      <meta name="twitter:site" content="@infinitecargo254" />
      <meta name="twitter:creator" content="@infinitecargo254" />
      <meta property="twitter:domain" content="infinitecargo.co.ke" />
      <meta property="twitter:url" content={finalCanonicalUrl} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={finalCanonicalUrl} />
      
      {/* Favicon and Icons */}
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      
      {/* Theme colors */}
      <meta name="theme-color" content="#1976d2" />
      <meta name="msapplication-TileColor" content="#1976d2" />
      
      {/* Web App Manifest */}
      <link rel="manifest" href="/manifest.json" />
      
      {/* Additional SEO tags */}
      <meta name="format-detection" content="telephone=no" />
      <meta name="language" content="English" />
      <meta name="geo.region" content="KE" />
      <meta name="geo.placename" content="Nairobi" />
      
      {/* Schema.org JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Infinite Cargo",
          "legalName": "Infinite Cargo Limited",
          "url": "https://infinitecargo.co.ke",
          "logo": {
            "@type": "ImageObject",
            "url": "https://infinitecargo.co.ke/images/logo.png",
            "width": 200,
            "height": 60
          },
          "description": finalDescription,
          "foundingDate": "2023",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Nairobi CBD",
            "addressLocality": "Nairobi",
            "addressRegion": "Nairobi County",
            "postalCode": "00100",
            "addressCountry": "KE"
          },
          "contactPoint": [{
            "@type": "ContactPoint",
            "telephone": "+254722483468",
            "contactType": "customer service",
            "email": "info@infinitecargo.co.ke",
            "availableLanguage": ["English", "Swahili"],
            "areaServed": "KE"
          }],
          "sameAs": [
            "https://www.facebook.com/infinitecargo254",
            "https://twitter.com/infinitecargo254",
            "https://www.linkedin.com/company/infinitecargo254",
            "https://www.instagram.com/infinitecargo254"
          ],
          "serviceArea": {
            "@type": "Country",
            "name": "Kenya"
          }
        })}
      </script>
    </Helmet>
  );
};

export default SEOHelmet;