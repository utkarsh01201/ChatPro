const sharp = require('sharp');

/**
 * Overlay text onto an image buffer using sharp & SVG
 * @param {Buffer} imageBuffer - Input image buffer
 * @param {string} text - Text to overlay (e.g. "Utkarsh")
 * @param {Object} options - Customization options
 */
async function overlayText(imageBuffer, text, options = {}) {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 800;

    const position = options.position || 'bottom'; // 'bottom', 'center', 'top'
    const font = options.font || 'Times New Roman, serif';
    const color = options.color || '#ffffff';

    // Calculate font size dynamically based on image dimensions and text length
    const baseSize = Math.round(width * 0.06);
    const fontSize = Math.max(24, Math.min(baseSize, Math.round((width * 0.8) / (text.length * 0.6))));

    // Calculate Y position
    let yPos = Math.round(height * 0.88);
    if (position === 'center') yPos = Math.round(height * 0.5);
    if (position === 'top') yPos = Math.round(height * 0.15);

    // Escape text for SVG safety
    const safeText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    // SVG with dark glow/drop shadow for maximum legibility on any image
    const svgOverlay = Buffer.from(`
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.9"/>
                </filter>
            </defs>
            <style>
                .custom-text {
                    font-family: ${font};
                    font-size: ${fontSize}px;
                    font-weight: bold;
                    fill: ${color};
                    text-anchor: middle;
                    filter: url(#shadow);
                }
            </style>
            <text x="${Math.round(width / 2)}" y="${yPos}" class="custom-text">${safeText}</text>
        </svg>
    `);

    const resultBuffer = await sharp(imageBuffer)
        .composite([{ input: svgOverlay, top: 0, left: 0 }])
        .jpeg({ quality: 95 })
        .toBuffer();

    return resultBuffer;
}

module.exports = {
    overlayText
};
