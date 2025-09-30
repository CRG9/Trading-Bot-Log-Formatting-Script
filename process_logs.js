/**
 * Mewtwo Image & JSON Combiner (v49 - Fixed Indecision Candle Cut-off & Spacing)
 * * Description:
 * Rectifies the issue where the Indecision Candle box was cut off by ensuring 
 * `totalRequiredWidth` correctly accounts for all elements. Re-applies 
 * previous header spacing adjustments without compromising horizontal layout.
 * * Usage:
 * node --expose-gc process_logs.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// --- CONFIGURATION ---
const ROOT_DIR = '.';
const OUTPUT_DIR = 'log_outputs';
const EXCLUDE_DIRS = ['log_outputs', 'node_modules', '.git'];
const PADDING = 20;
const BACKGROUND_COLOR = '#141414';
const TEXT_COLOR = '#DCDCDC';
const TABLE_BACKGROUND_COLOR = '#2a2a2a';
const BID_COLOR = '#ff4d4d'; // Red for specific bids/BEARISH
const BEARISH = BID_COLOR; // Red for specific bids/BEARISH
const ASK_COLOR = '#33cc33'; // Green for specific asks/BULLISH
const BULLISH = ASK_COLOR; // Green for specific asks/BULLISH
const FONT_SIZE = 14;
const HEADER_FONT_SIZE = 18;
const LINE_HEIGHT = FONT_SIZE * 1.4;
const TABLE_GAP = 25;
const TABLE_WIDTH = 192;
const CANDLE_TABLE_WIDTH = 180;
const MARKET_STRUCTURE_WIDTH = 180;
const HEADER_TO_BOX_SPACING = LINE_HEIGHT * 0.75; 
const SVG_MIN_HEIGHT_PX = 150; // Guaranteed extra space at the bottom
const TRADE_DETAILS_WIDTH = 250; // New explicit width for the combined trade detail box

// --- SVG GENERATION LOGIC ---
function getOrdinal(n) {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '>').replace(/"/g, '&quot;');
}

/**
 * Generates an SVG group containing a single candle's details in a box format.
 */
function formatCandleTable(title, candleData, width, height) {
    if (!candleData) return { svg: '', width: 0 };
    
    let tspanElements = '';
    tspanElements += `<tspan x="${PADDING}" dy="${LINE_HEIGHT}" font-weight="bold">${title}</tspan>`;
    
    const details = [
        `Indecisive: ${String(candleData.isIndecisive)}`,
        `Open: ${candleData.open}`,
        `Close: ${candleData.close}`,
        `High: ${candleData.high}`,
        `Low: ${candleData.low}`,
    ];

    details.forEach(detail => {
        tspanElements += `<tspan x="${PADDING}" dy="${LINE_HEIGHT}">${escapeHtml(detail)}</tspan>`;
    });

    const tableRect = `<rect x="0" y="0" width="${width}" height="${height}" fill="${TABLE_BACKGROUND_COLOR}" rx="5" />`;

    const svg = `<g>
        ${tableRect}
        <text y="${FONT_SIZE}" font-family="monospace" font-size="${FONT_SIZE}" fill="${TEXT_COLOR}">${tspanElements}</text>
    </g>`;
    
    return { svg: svg, width: width + TABLE_GAP };
}

/**
 * Generates an SVG group containing the Order Volume in a simple box.
 */
function formatOrderVolumeTable(volume, width, height) {
    if (volume === undefined) return { svg: '', width: 0 };

    let tspanElements = '';
    tspanElements += `<tspan x="${PADDING}" dy="${LINE_HEIGHT}" font-weight="bold">Order Volume</tspan>`;
    tspanElements += `<tspan x="${PADDING}" dy="${LINE_HEIGHT}">${volume}</tspan>`;

    const tableRect = `<rect x="0" y="0" width="${width}" height="${height}" fill="${TABLE_BACKGROUND_COLOR}" rx="5" />`;

    const svg = `<g>
        ${tableRect}
        <text y="${FONT_SIZE}" font-family="monospace" font-size="${FONT_SIZE}" fill="${TEXT_COLOR}">${tspanElements}</text>
    </g>`;
    
    return { svg: svg, width: width + TABLE_GAP };
}

/**
 * Generates an SVG group for the Market Structure in a simple box.
 */
function formatMarketStructureTable(structure, width, height) {
    if (!structure) return { svg: '', width: 0 };

    let marketStructureColor = TEXT_COLOR;
    if (structure === 'BEARISH') {
        marketStructureColor = BEARISH; 
    } else if (structure === 'BULLISH') {
        marketStructureColor = BULLISH; 
    }

    let tspanElements = '';
    tspanElements += `<tspan x="${PADDING}" dy="${LINE_HEIGHT}" font-weight="bold">Market Structure</tspan>`;
    tspanElements += `<tspan x="${PADDING}" dy="${LINE_HEIGHT}" fill="${marketStructureColor}">${structure}</tspan>`;

    const tableRect = `<rect x="0" y="0" width="${width}" height="${height}" fill="${TABLE_BACKGROUND_COLOR}" rx="5" />`;

    const svg = `<g>
        ${tableRect}
        <text y="${FONT_SIZE}" font-family="monospace" font-size="${FONT_SIZE}" fill="${TEXT_COLOR}">${tspanElements}</text>
    </g>`;
    
    return { svg: svg, width: width + TABLE_GAP };
}


function createDataSvg(jsonData) {
    const { imbalances, ...details } = jsonData;
    const currentMarketStructure = details.currentMarketStructure;
    let svgElements = '';
    let totalRequiredWidth = 0;
    let currentY = PADDING;

    // --- ROW 1: MAIN HEADER ---
    const headerY = currentY + HEADER_FONT_SIZE;
    svgElements += `<text x="${PADDING}" y="${headerY}" font-family="sans-serif" font-size="${HEADER_FONT_SIZE}" font-weight="bold" fill="${TEXT_COLOR}">Trade Setup Details</text>`;

    currentY = headerY + HEADER_TO_BOX_SPACING; 

    // --- ROW 2: CONTEXTUAL METADATA BOXES (Market Structure, Order Volume, Indecision Candle) ---
    const contextRowY = currentY;
    let currentContextX = PADDING;
    
    // Define common height for alignment
    const candleTableLineCount = 6;
    const commonTableHeight = (candleTableLineCount * LINE_HEIGHT) + (PADDING * 1.5);
    
    // 1. Market Structure Box
    const msResult = formatMarketStructureTable(
        currentMarketStructure, 
        MARKET_STRUCTURE_WIDTH, 
        commonTableHeight
    );
    svgElements += `<g transform="translate(${currentContextX}, ${contextRowY})">${msResult.svg}</g>`;
    currentContextX += msResult.width;
    delete details.currentMarketStructure; 

    // 2. Order Volume Box
    if (details.orderVolume !== undefined) {
        const orderVolumeResult = formatOrderVolumeTable(
            details.orderVolume, 
            MARKET_STRUCTURE_WIDTH, 
            commonTableHeight
        );
        svgElements += `<g transform="translate(${currentContextX}, ${contextRowY})">${orderVolumeResult.svg}</g>`;
        currentContextX += orderVolumeResult.width;
        delete details.orderVolume;
    }

    // 3. Indecision Candle Box
    if (details.indecisionCandle) {
        const indecisionResult = formatCandleTable(
            'Indecision Candle', 
            details.indecisionCandle, 
            CANDLE_TABLE_WIDTH, 
            commonTableHeight
        );
        svgElements += `<g transform="translate(${currentContextX}, ${contextRowY})">${indecisionResult.svg}</g>`;
        currentContextX += indecisionResult.width;
        delete details.indecisionCandle;
    }

    // Update currentY after context row
    currentY = contextRowY + commonTableHeight + PADDING; 
    // CRITICAL FIX: Ensure totalRequiredWidth tracks the furthest point of the widest row
    totalRequiredWidth = Math.max(totalRequiredWidth, currentContextX);
    
    // --- ROW 3: IMBALANCE HEADER ---
    const imbalanceHeaderY = currentY + HEADER_FONT_SIZE;
    svgElements += `<text x="${PADDING}" y="${imbalanceHeaderY}" font-family="sans-serif" font-size="${HEADER_FONT_SIZE}" font-weight="bold" fill="${TEXT_COLOR}">Zone Imbalances</text>`;
    
    currentY = imbalanceHeaderY + HEADER_TO_BOX_SPACING;

    // --- ROW 4: IMBALANCE TABLES (PRECEEDING CANDLES) ---
    const imbalanceTablesY = currentY;

    const tableKeys = Object.keys(imbalances).sort((a, b) => parseInt(b) - parseInt(a));
    
    let maxTableLineCount = 0;
    for (const key of tableKeys) {
        const { bids, asks } = imbalances[key];
        const rowCount = Math.max(bids.length, asks.length);
        const tableLineCount = 2 + rowCount;
        maxTableLineCount = Math.max(maxTableLineCount, tableLineCount);
    }

    const uniformTableHeight = (maxTableLineCount * LINE_HEIGHT) + (PADDING * 1.5);

    let currentImbalanceX = PADDING;
    for (const key of tableKeys) {
        let tableTspanElements = '';
        const number = parseInt(key);
        const title = (number === 1) ? 'Indecision Candle' 
                                     : `${number - 1}${getOrdinal(number - 1)} Preceding Candle`;
        tableTspanElements += `<tspan x="${PADDING}" dy="${LINE_HEIGHT}" font-weight="bold">${title}</tspan>`;
        
        const asksX = PADDING + 80;
        tableTspanElements += `<tspan x="${PADDING}" dy="${LINE_HEIGHT}" text-decoration="underline">Bids</tspan>`;
        tableTspanElements += `<tspan x="${asksX}" text-decoration="underline">Asks</tspan>`;

        const { bids, asks } = imbalances[key];
        const rowCount = Math.max(bids.length, asks.length);
        for (let i = 0; i < rowCount; i++) {
            let bidColor = TEXT_COLOR;
            let askColor = TEXT_COLOR;
            if (currentMarketStructure === 'BEARISH' && i === 0) {
                bidColor = BID_COLOR;
                askColor = ASK_COLOR;
            }
            if (currentMarketStructure === 'BULLISH' && i === rowCount - 1) {
                bidColor = BID_COLOR;
                askColor = ASK_COLOR;
            }
            const bidText = bids[i] ?? '';
            const askText = asks[i] ?? '';
            tableTspanElements += `<tspan x="${PADDING}" dy="${LINE_HEIGHT}" fill="${bidColor}">${bidText}</tspan><tspan x="${asksX}" fill="${askColor}">${askText}</tspan>`;
        }
        
        const tableRect = `<rect x="0" y="0" width="${TABLE_WIDTH}" height="${uniformTableHeight}" fill="${TABLE_BACKGROUND_COLOR}" rx="5" />`;

        svgElements += `<g transform="translate(${currentImbalanceX}, ${imbalanceTablesY})">
            ${tableRect}
            <text y="${FONT_SIZE}" font-family="monospace" font-size="${FONT_SIZE}" fill="${TEXT_COLOR}">${tableTspanElements}</text>
        </g>`;

        currentImbalanceX += TABLE_WIDTH + TABLE_GAP;
    }

    // Update currentY after imbalance tables
    currentY = imbalanceTablesY + uniformTableHeight; 
    // CRITICAL FIX: Ensure totalRequiredWidth tracks the furthest point of the widest row
    totalRequiredWidth = Math.max(totalRequiredWidth, currentImbalanceX);
    
    // --- LOWER TIMEFRAME CONFLUENCE TABLES ---
    
    const confluenceTimeframes = ['M1', 'M5', 'M15', 'M30', 'H1']; 
    const confluenceCandles = [];

    const allDetails = { ...details, ...(details.confluence || {}) };

    for (const tf of confluenceTimeframes) {
        if (allDetails[tf]) {
            confluenceCandles.push({ title: `${tf} Candle`, data: allDetails[tf] });
            delete details[tf]; 
        }
    }
    delete details.confluence; 

    if (confluenceCandles.length > 0) {
        // FIX 1: Add extra vertical padding before the header
        currentY += PADDING * 1.5; 
        
        // Print Header
        const confluenceHeaderY = currentY + HEADER_FONT_SIZE;
        svgElements += `<text x="${PADDING}" y="${confluenceHeaderY}" font-family="sans-serif" font-size="${HEADER_FONT_SIZE}" font-weight="bold" fill="${TEXT_COLOR}">Lower Timeframe Confluence</text>`;
        
        currentY = confluenceHeaderY + HEADER_TO_BOX_SPACING;
        
        // Print Tables
        const confluenceTablesY = currentY;
        let currentConfluenceX = PADDING;

        for (const candle of confluenceCandles) {
            const result = formatCandleTable(
                candle.title, 
                candle.data, 
                CANDLE_TABLE_WIDTH, 
                commonTableHeight 
            );
            
            svgElements += `<g transform="translate(${currentConfluenceX}, ${confluenceTablesY})">${result.svg}</g>`;
            
            currentConfluenceX += result.width;
        }
        
        // Update currentY after confluence tables
        currentY = confluenceTablesY + commonTableHeight;

        // CRITICAL FIX: Ensure totalRequiredWidth tracks the furthest point of the widest row
        totalRequiredWidth = Math.max(totalRequiredWidth, currentConfluenceX);
    }
    
    // --- PROSPECTIVE TRADE DETAILS (Final Layout with all fields) ---
    const limitOrderDetails = details.limitOrder;

    // Correctly extract fields from the nested structure
    const limitPrice = limitOrderDetails?.limitPrice;
    const takeProfit = limitOrderDetails?.takeProfit;
    const stopLoss = limitOrderDetails?.stopLoss;
    const zonePips = limitOrderDetails?.zonePips;
    const takeProfitPips = limitOrderDetails?.takeProfitPips;
    const stopLossPips = limitOrderDetails?.stopLossPips;
    
    // Clean up parent object
    if (details.limitOrder) delete details.limitOrder;

    // Check if any prospective trade data exists
    if (limitPrice !== undefined) { 
        
        // FIX 2: Add extra vertical padding before the header
        currentY += PADDING * 1.0; 
        
        // --- 1. PRINT HEADER (OUTSIDE THE BOX) ---
        const tradeHeaderY = currentY + HEADER_FONT_SIZE; // Position the header line
        svgElements += `<text x="${PADDING}" y="${tradeHeaderY}" font-family="sans-serif" font-size="${HEADER_FONT_SIZE}" font-weight="bold" fill="${TEXT_COLOR}">Prospective Trade</text>`;
        
        currentY = tradeHeaderY + HEADER_TO_BOX_SPACING; // Reset currentY for the box content
        
        // 2. COLLECT ALL TEXT LINES (ALL required data)
        const tradeLines = [];
        
        if (limitPrice !== undefined) {
            tradeLines.push({ text: `Limit Price: ${limitPrice}`, bold: false, indent: true });
        }
        if (takeProfit !== undefined) {
            tradeLines.push({ text: `Take Profit: ${takeProfit}`, bold: false, indent: true });
        }
        if (stopLoss !== undefined) {
            tradeLines.push({ text: `Stop Loss: ${stopLoss}`, bold: false, indent: true });
        }
        
        // Pips data 
        if (zonePips !== undefined) {
            tradeLines.push({ text: `Zone Pips: ${zonePips}`, bold: false, indent: true });
        }
        if (takeProfitPips !== undefined) {
            tradeLines.push({ text: `Take Profit Pips: ${takeProfitPips}`, bold: false, indent: true });
        }
        if (stopLossPips !== undefined) {
            tradeLines.push({ text: `Stop Loss Pips: ${stopLossPips}`, bold: false, indent: true });
        }
        
        // 3. CALCULATE BOX DIMENSIONS
        const boxContentHeight = (tradeLines.length * LINE_HEIGHT) + PADDING; 
        const boxWidth = TRADE_DETAILS_WIDTH;
        const boxHeight = boxContentHeight;

        // 4. RENDER BACKGROUND BOX (Grouping the whole section)
        const tradeBoxY = currentY; // Top of the box starts here
        
        svgElements += `<g transform="translate(${PADDING}, ${tradeBoxY})">`;
        svgElements += `<rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" fill="${TABLE_BACKGROUND_COLOR}" rx="5" />`;
        
        // 5. RENDER TEXT INSIDE BOX (TSPAN)
        let tspanElements = '';
        tradeLines.forEach((line, index) => {
            const xPos = line.indent ? PADDING : 0;
            // The first line should offset from the box's top boundary (y=0 in the group)
            const dy = index === 0 ? PADDING : LINE_HEIGHT; // Fix: Use PADDING for consistent top padding
            const weight = line.bold ? 'bold' : 'normal';

            tspanElements += `<tspan x="${xPos}" dy="${dy}" font-weight="${weight}">${escapeHtml(line.text)}</tspan>`;
        });
        
        svgElements += `<text y="${0}" font-family="monospace" font-size="${FONT_SIZE}" fill="${TEXT_COLOR}">${tspanElements}</text>`;
        
        // Close the group
        svgElements += `</g>`;
        
        // 6. UPDATE currentY
        currentY = tradeBoxY + boxHeight + PADDING; // Advance currentY past the box
        
        // CRITICAL FIX: Ensure totalRequiredWidth tracks the furthest point of the widest row
        totalRequiredWidth = Math.max(totalRequiredWidth, PADDING + boxWidth + PADDING); 
    }
    
    // Update total required height
    let totalRequiredHeight = currentY; 

    // --- REMAINING DETAILS (Fallback for unhandled data) ---
    const remainingDetailsText = JSON.stringify(details, null, 2);
    let remainingLineCount = 0;

    if (remainingDetailsText !== '{}') {
        
        let detailsTspanElements = `<tspan x="0" dy="0" font-weight="bold">Remaining Details (JSON)</tspan>`;
        
        const detailLines = remainingDetailsText.split('\n');
        detailLines.forEach(line => {
            detailsTspanElements += `<tspan x="${PADDING}" dy="${LINE_HEIGHT}">${escapeHtml(line)}</tspan>`;
        });
        remainingLineCount = detailLines.length + 1; // +1 for the header line

        const detailsTextY = currentY + FONT_SIZE; // Use currentY for absolute start + FONT_SIZE for baseline
        svgElements += `<text x="${PADDING}" y="${detailsTextY}" font-family="monospace" font-size="${FONT_SIZE}" fill="${TEXT_COLOR}">${detailsTspanElements}</text>`;
        totalRequiredHeight = detailsTextY + (remainingLineCount * LINE_HEIGHT);
    }

    return {
        svgContent: svgElements,
        calculatedWidth: totalRequiredWidth + PADDING, // Ensure final padding on the right
        // CRITICAL FIX: Add fixed buffer to calculated height to prevent cutoff
        calculatedHeight: totalRequiredHeight + PADDING + SVG_MIN_HEIGHT_PX 
    };
}


// --- CORE SCRIPT LOGIC (unchanged) ---
async function createCombinedImage(pngPath, jsonPath) {
    try {
        const jsonContent = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
        const jsonData = JSON.parse(jsonContent);

        const cleanPngBuffer = await sharp(pngPath).png().toBuffer();
        const metadata = await sharp(cleanPngBuffer).metadata();

        if (!metadata || !metadata.width || !metadata.height) {
            throw new Error('Failed to read valid dimensions from sanitized image.');
        }

        const { svgContent, calculatedWidth, calculatedHeight } = createDataSvg(jsonData);

        const newWidth = metadata.width + calculatedWidth + PADDING;
        const newHeight = Math.ceil(Math.max(metadata.height + PADDING * 2, calculatedHeight));
        
        const finalSvg = `<svg width="${calculatedWidth}" height="${newHeight}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;

        const outputBuffer = await sharp({
            create: {
                width: newWidth,
                height: newHeight,
                channels: 4,
                background: BACKGROUND_COLOR
            }
        })
        .composite([
            { input: cleanPngBuffer, top: PADDING, left: PADDING },
            { input: Buffer.from(finalSvg), top: 0, left: metadata.width + PADDING }
        ])
        .png()
        .toBuffer();

        const relativeDir = path.dirname(path.relative(ROOT_DIR, pngPath));
        const outputSubfolder = path.join(OUTPUT_DIR, relativeDir);
        fs.mkdirSync(outputSubfolder, { recursive: true });

        const outputFileName = `${path.basename(pngPath, path.extname(pngPath))}.png`;
        const outputPath = path.join(outputSubfolder, outputFileName);
        
        fs.writeFileSync(outputPath, outputBuffer);
        console.log(`  ✅ Created: ${outputPath}`);

    } catch (e) {
        console.error(`  ❌ Failed to process ${path.basename(pngPath)}: ${e.message}`);
    }
}
function setupOutputDirectory() {
    if (fs.existsSync(OUTPUT_DIR)) {
        for (const item of fs.readdirSync(OUTPUT_DIR)) {
            if (item === '.obsidian') continue;
            fs.rmSync(path.join(OUTPUT_DIR, item), { recursive: true, force: true });
        }
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Directory '${OUTPUT_DIR}' is ready.`);
}
function findFilePairs() {
    const pairs = {};
    console.log(`Scanning for .png/.json pairs in '${path.resolve(ROOT_DIR)}'...`);
    function scan(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            if (EXCLUDE_DIRS.includes(item)) continue;
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                scan(fullPath);
            } else if (stat.isFile()) {
                const ext = path.extname(fullPath);
                const stem = path.basename(fullPath, ext);
                const normalizedStem = stem.replace(/[\s_]/g, '-');
                if (ext === '.png' || ext === '.json') {
                    if (!pairs[normalizedStem]) pairs[normalizedStem] = {};
                    pairs[normalizedStem][ext] = fullPath;
                }
            }
        }
    }
    scan(ROOT_DIR);
    return Object.values(pairs).filter(p => p['.png'] && p['.json']);
}
async function main() {
    setupOutputDirectory();
    const pairs = findFilePairs();
    if (pairs.length === 0) {
        console.log("No matching .png/.json pairs found.");
        return;
    }
    console.log(`\nFound ${pairs.length} pairs. Starting processing...\n`);
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        console.log(`Processing pair ${i + 1}/${pairs.length}: ${path.basename(pair['.png'])}`);
        await createCombinedImage(pair['.png'], pair['.json']);
        if (global.gc) {
            global.gc();
        }
    }
    console.log(`\n🎉 Finished! Processed ${pairs.length} pairs.`);
}
(async () => {
    try {
        await main();
    } catch (error) {
        console.error(`❌ A critical error occurred: ${error.message}`);
    }
})();