// scripts/generate-sitemap.js
// Run with: node scripts/generate-sitemap.js

const fs = require('fs');
const path = require('path');

const generateSitemap = () => {
  const baseUrl = 'https://infinitecargo.co.ke';
  const routes = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/about', priority: '0.8', changefreq: 'monthly' },
    { url: '/services', priority: '0.9', changefreq: 'weekly' },
    { url: '/how-it-works', priority: '0.8', changefreq: 'monthly' },
    { url: '/pricing', priority: '0.9', changefreq: 'weekly' },
    { url: '/login', priority: '0.6', changefreq: 'yearly' },
    { url: '/register', priority: '0.7', changefreq: 'yearly' },
    { url: '/search-loads', priority: '0.9', changefreq: 'hourly' },
    { url: '/find-drivers', priority: '0.9', changefreq: 'hourly' },
    { url: '/contact', priority: '0.7', changefreq: 'monthly' },
    { url: '/faq', priority: '0.6', changefreq: 'monthly' },
    { url: '/support', priority: '0.7', changefreq: 'monthly' },
    { url: '/requirements', priority: '0.6', changefreq: 'monthly' },
    { url: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
    { url: '/terms-of-service', priority: '0.3', changefreq: 'yearly' }
  ];

  const currentDate = new Date().toISOString().split('T')[0];
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  routes.forEach(route => {
    sitemap += `
  <url>
    <loc>${baseUrl}${route.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
  });

  sitemap += `
</urlset>`;

  // Write to build directory
  const buildDir = path.join(__dirname, '../build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(buildDir, 'sitemap.xml'), sitemap);
  console.log('✅ Sitemap generated successfully!');
  
  // Generate robots.txt
  const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /driver-dashboard
Disallow: /cargo-dashboard
Disallow: /driver/profile
Disallow: /driver/job/

Sitemap: ${baseUrl}/sitemap.xml`;

  fs.writeFileSync(path.join(buildDir, 'robots.txt'), robots);
  console.log('✅ Robots.txt generated successfully!');
  
  // Generate a simple report
  console.log('\n📊 Sitemap Report:');
  console.log(`   📄 Total URLs: ${routes.length}`);
  console.log(`   🔗 Base URL: ${baseUrl}`);
  console.log(`   📅 Generated: ${currentDate}`);
  console.log(`   📁 Output: ${path.join(buildDir, 'sitemap.xml')}`);
};

generateSitemap();