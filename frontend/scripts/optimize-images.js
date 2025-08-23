// scripts/optimize-images.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const optimizeImages = async () => {
  const inputDir = './public/';
  const outputDir = './public/';
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const imageFiles = [
    '1.jpg', '2.jpg', '3.jpg', '4.jpg','5.jpg', // Your existing images
    'og-image.jpg', 'twitter-card.jpg', 'logo.png'
  ];

  console.log('🚀 Starting image optimization...\n');

  for (const file of imageFiles) {
    const inputPath = path.join(inputDir, file);
    const fileExtension = path.extname(file);
    const fileName = path.basename(file, fileExtension);
    
    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  File not found: ${inputPath}`);
      continue;
    }

    try {
      const metadata = await sharp(inputPath).metadata();
      console.log(`📊 Processing ${file}: ${metadata.width}x${metadata.height}, ${Math.round(metadata.size / 1024)}KB`);

      // Generate multiple optimized versions
      const sizes = [
        { suffix: '-small', width: 400, quality: 80 },
        { suffix: '-medium', width: 800, quality: 85 },
        { suffix: '-large', width: 1200, quality: 90 },
        { suffix: '', width: 1920, quality: 85 } // Original size replacement
      ];

      for (const size of sizes) {
        // WebP version (modern browsers)
        const webpOutput = path.join(outputDir, `${fileName}${size.suffix}.webp`);
        await sharp(inputPath)
          .resize(size.width, null, { 
            withoutEnlargement: true,
            fit: 'inside'
          })
          .webp({ quality: size.quality })
          .toFile(webpOutput);

        // JPEG/PNG version (fallback)
        const fallbackExt = fileExtension === '.png' ? '.png' : '.jpg';
        const fallbackOutput = path.join(outputDir, `${fileName}${size.suffix}${fallbackExt}`);
        
        let sharpInstance = sharp(inputPath)
          .resize(size.width, null, { 
            withoutEnlargement: true,
            fit: 'inside'
          });

        if (fallbackExt === '.jpg') {
          sharpInstance = sharpInstance.jpeg({ quality: size.quality, mozjpeg: true });
        } else {
          sharpInstance = sharpInstance.png({ quality: size.quality });
        }

        await sharpInstance.toFile(fallbackOutput);

        const optimizedStats = fs.statSync(fallbackOutput);
        const webpStats = fs.statSync(webpOutput);
        
        console.log(`✅ Generated ${fileName}${size.suffix}:`);
        console.log(`   📄 ${fallbackExt.toUpperCase()}: ${Math.round(optimizedStats.size / 1024)}KB`);
        console.log(`   🖼️  WebP: ${Math.round(webpStats.size / 1024)}KB`);
      }

      console.log(''); // Empty line for readability

    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }

  console.log('🎉 Image optimization complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Copy optimized images from /optimized to /images folder');
  console.log('2. Update your React components to use ResponsiveImage component');
  console.log('3. Test on different devices and connection speeds');
  
  // Generate summary report
  generateOptimizationReport(outputDir);
};

const generateOptimizationReport = (outputDir) => {
  const files = fs.readdirSync(outputDir);
  const report = {
    totalFiles: files.length,
    webpFiles: files.filter(f => f.endsWith('.webp')).length,
    jpegFiles: files.filter(f => f.endsWith('.jpg')).length,
    pngFiles: files.filter(f => f.endsWith('.png')).length
  };

  console.log('\n📊 Optimization Report:');
  console.log(`   Total files generated: ${report.totalFiles}`);
  console.log(`   WebP files: ${report.webpFiles}`);
  console.log(`   JPEG files: ${report.jpegFiles}`);
  console.log(`   PNG files: ${report.pngFiles}`);
};

// Run the optimization
optimizeImages().catch(console.error);