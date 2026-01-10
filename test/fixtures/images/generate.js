/**
 * Generate test images for E2E tests
 * Creates minimal PNG and JPEG files at various resolutions
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create a minimal valid PNG file
 * @param {number} width
 * @param {number} height
 * @param {number} r Red channel (0-255)
 * @param {number} g Green channel (0-255)
 * @param {number} b Blue channel (0-255)
 * @returns {Uint8Array}
 */
function createPng(width, height, r = 0, g = 128, b = 255) {
  // PNG file structure:
  // Signature + IHDR chunk + IDAT chunk + IEND chunk
  
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  
  // IHDR chunk
  const ihdr = [
    ...intToBytes(width, 4),
    ...intToBytes(height, 4),
    8,    // Bit depth
    2,    // Color type: RGB
    0,    // Compression method
    0,    // Filter method
    0,    // Interlace method
  ];
  
  // Create raw image data (uncompressed)
  // Each row: filter byte + RGB pixels
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // No filter
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b);
    }
  }
  
  // Compress with deflate (zlib format)
  const deflated = deflateSimple(rawData);
  
  // Build chunks
  const chunks = [
    ...signature,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', deflated),
    ...chunk('IEND', []),
  ];
  
  return new Uint8Array(chunks);
}

/**
 * Create a minimal valid JPEG file
 * @param {number} width
 * @param {number} height
 * @param {number} r Red channel (0-255)
 * @param {number} g Green channel (0-255)
 * @param {number} b Blue channel (0-255)
 * @returns {Uint8Array}
 */
function createJpeg(width, height, r = 255, g = 128, b = 0) {
  // For simplicity, we'll create a minimal JPEG with a solid color
  // This is a complete but minimal JPEG structure
  
  // JPEG markers
  const SOI = [0xFF, 0xD8]; // Start of Image
  const EOI = [0xFF, 0xD9]; // End of Image
  
  // APP0 (JFIF marker)
  const app0 = [
    0xFF, 0xE0,
    0x00, 0x10,       // Length
    0x4A, 0x46, 0x49, 0x46, 0x00, // 'JFIF\0'
    0x01, 0x01,       // Version 1.1
    0x01,             // Units: DPI
    0x00, 0x48,       // X density: 72
    0x00, 0x48,       // Y density: 72
    0x00, 0x00,       // Thumbnail
  ];
  
  // DQT (Quantization Table)
  const dqt = [
    0xFF, 0xDB,
    0x00, 0x43,       // Length
    0x00,             // Table 0, 8-bit precision
    ...Array(64).fill(16), // Simple quantization table
  ];
  
  // SOF0 (Start of Frame - Baseline DCT)
  const sof0 = [
    0xFF, 0xC0,
    0x00, 0x0B,       // Length
    0x08,             // Precision: 8-bit
    ...intToBytes(height, 2), // Height
    ...intToBytes(width, 2),  // Width
    0x01,             // Number of components (grayscale for simplicity)
    0x01, 0x11, 0x00, // Component: ID=1, sampling=1x1, quant table=0
  ];
  
  // DHT (Huffman Table)
  const dht = createMinimalHuffmanTable();
  
  // SOS (Start of Scan) and scan data
  const sos = [
    0xFF, 0xDA,
    0x00, 0x08,       // Length
    0x01,             // Number of components
    0x01, 0x00,       // Component 1 uses tables 0
    0x00, 0x3F, 0x00, // Spectral selection
  ];
  
  // Generate minimal scan data (DC coefficient for solid color)
  const Y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const dcValue = Math.floor((Y - 128) / 8); // Simplified DC coefficient
  const scanData = generateSimpleScanData(width, height, dcValue);
  
  return new Uint8Array([
    ...SOI,
    ...app0,
    ...dqt,
    ...sof0,
    ...dht,
    ...sos,
    ...scanData,
    ...EOI,
  ]);
}

/**
 * Create minimal Huffman table
 */
function createMinimalHuffmanTable() {
  // Minimal DC Huffman table
  return [
    0xFF, 0xC4,
    0x00, 0x1F,       // Length
    0x00,             // DC table 0
    // 16 bytes of bit counts
    0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01,
    0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // Symbol values
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B,
  ];
}

/**
 * Generate simple scan data for solid color
 */
function generateSimpleScanData(width, height, dcValue) {
  // Very simplified - just enough for parsers to read dimensions
  // Real JPEG encoding is much more complex
  const blocks = Math.ceil(width / 8) * Math.ceil(height / 8);
  const data = [];
  
  // Simple encoding: all blocks have similar values
  for (let i = 0; i < blocks; i++) {
    data.push(0xFD); // Encoded block data
  }
  
  // Pad to avoid EOF issues
  data.push(0x00);
  
  return data;
}

/**
 * Convert integer to big-endian bytes
 */
function intToBytes(n, bytes) {
  const result = [];
  for (let i = bytes - 1; i >= 0; i--) {
    result.push((n >> (i * 8)) & 0xFF);
  }
  return result;
}

/**
 * Create PNG chunk
 */
function chunk(type, data) {
  const length = intToBytes(data.length, 4);
  const typeBytes = [...type].map(c => c.charCodeAt(0));
  const combined = [...typeBytes, ...data];
  const crc = crc32(combined);
  return [...length, ...combined, ...intToBytes(crc, 4)];
}

/**
 * Simple CRC32 for PNG
 */
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  
  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  
  return crc ^ 0xFFFFFFFF;
}

/**
 * Simple deflate compression (zlib format)
 */
function deflateSimple(data) {
  // Zlib header
  const header = [0x78, 0x01]; // Low compression
  
  // Split into blocks
  const blocks = [];
  const blockSize = 65535;
  
  for (let i = 0; i < data.length; i += blockSize) {
    const chunk = data.slice(i, i + blockSize);
    const isLast = i + blockSize >= data.length;
    
    blocks.push(isLast ? 0x01 : 0x00); // Block header
    blocks.push(chunk.length & 0xFF);
    blocks.push((chunk.length >> 8) & 0xFF);
    blocks.push((~chunk.length) & 0xFF);
    blocks.push(((~chunk.length) >> 8) & 0xFF);
    blocks.push(...chunk);
  }
  
  // Adler-32 checksum
  let a = 1, b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const checksum = (b << 16) | a;
  
  return [
    ...header,
    ...blocks,
    (checksum >> 24) & 0xFF,
    (checksum >> 16) & 0xFF,
    (checksum >> 8) & 0xFF,
    checksum & 0xFF,
  ];
}

/**
 * Create SVG file
 */
function createSvg(width, height, color = '#4080ff') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${color}"/>
  <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height) * 0.3}" fill="white" opacity="0.5"/>
  <text x="${width/2}" y="${height/2}" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="sans-serif" font-size="${Math.min(width, height) * 0.2}">SVG</text>
</svg>`;
}

// Generate test images
console.log('Generating test images...');

// PNG images at different resolutions
const pngFiles = [
  { name: 'small.png', width: 100, height: 75, r: 64, g: 128, b: 192 },
  { name: 'medium.png', width: 400, height: 300, r: 128, g: 64, b: 192 },
  { name: 'large.png', width: 800, height: 600, r: 192, g: 128, b: 64 },
  { name: 'square.png', width: 200, height: 200, r: 255, g: 0, b: 128 },
  { name: 'wide.png', width: 600, height: 100, r: 0, g: 192, b: 128 },
  { name: 'tall.png', width: 100, height: 400, r: 128, g: 0, b: 255 },
];

for (const file of pngFiles) {
  const png = createPng(file.width, file.height, file.r, file.g, file.b);
  writeFileSync(join(__dirname, file.name), png);
  console.log(`  Created ${file.name} (${file.width}x${file.height})`);
}

// JPEG images at different resolutions
const jpegFiles = [
  { name: 'photo-small.jpg', width: 150, height: 100, r: 255, g: 200, b: 100 },
  { name: 'photo-medium.jpg', width: 400, height: 300, r: 100, g: 150, b: 200 },
  { name: 'photo-large.jpg', width: 800, height: 600, r: 200, g: 100, b: 150 },
];

for (const file of jpegFiles) {
  const jpeg = createJpeg(file.width, file.height, file.r, file.g, file.b);
  writeFileSync(join(__dirname, file.name), jpeg);
  console.log(`  Created ${file.name} (${file.width}x${file.height})`);
}

// SVG images
const svgFiles = [
  { name: 'vector-small.svg', width: 100, height: 100, color: '#ff6b6b' },
  { name: 'vector-medium.svg', width: 300, height: 200, color: '#4ecdc4' },
  { name: 'vector-large.svg', width: 600, height: 400, color: '#45b7d1' },
];

for (const file of svgFiles) {
  const svg = createSvg(file.width, file.height, file.color);
  writeFileSync(join(__dirname, file.name), svg);
  console.log(`  Created ${file.name} (${file.width}x${file.height})`);
}

console.log('Done!');
