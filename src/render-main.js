/**
 * mdtypst - Modular renderer implementation
 * Orchestrates: fetch, WASM init, and output delivery.
 */

import { fetchWithCache } from './cache.js';
import {
    closeUnclosedBacktickFence,
    parseFrontmatter,
} from './frontmatter.js';
import { createLogger, createTimings } from './logging.js';
import { renderMermaidBlocksToSvgAssets } from './mermaid.js';
import { mountAndRewriteImages } from './assets.js';
import { markdownToTypstFallback, markdownToTypstWithCmarker } from './typst-doc.js';
import { loadSidecar } from './sidecar.js';

// Flag used by the root entrypoint (`render.js`) and the fixture harness to
// confirm the modular implementation loaded.
globalThis.__mdtypst__impl_loaded = true;

// State management
let pdfBlob = null;
let lastTypstSource = null;
let cmarkerAvailable = true;
let lastSidecarUrl = null;
let lastTemplateUrl = null;

const timings = createTimings();

// UI elements
const statusEl = document.getElementById('status');
const pdfContainer = document.getElementById('pdf-container');
const pdfViewer = document.getElementById('pdf-viewer');
const downloadBtn = document.getElementById('download-btn');

const urlParams = new URLSearchParams(window.location.search);
// Debug logging is enabled by default; disable with ?debug=0.
const debugEnabled = urlParams.get('debug') !== '0';

// If enabled, we never retry with the fallback renderer.
const noFallback = urlParams.get('noFallback') === '1';

const { debugLog, markTiming, incCounter } = createLogger({ debugEnabled, timings });

/**
 * Update status message
 */
function updateStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = type;
}

async function ensureTypstPackageRegistry($typst) {
    // Ensure Typst can resolve @preview/... imports in the browser.
    // Must run before the compiler is initialized.
    try {
        const TypstSnippet = globalThis.TypstSnippet;
        if (!TypstSnippet || typeof $typst?.use !== 'function') return;

        $typst.use(TypstSnippet.fetchPackageRegistry());
        if (typeof $typst.prepareUse === 'function') {
            await $typst.prepareUse();
        }
    } catch (e) {
        console.warn('Typst package registry setup failed; will use fallback renderer if needed.', e);
        cmarkerAvailable = false;
    }
}

/**
 * Wait for the typst.ts bundle to expose the global $typst instance.
 */
async function waitForTypst() {
    markTiming('typst:wait:start');
    debugLog('waitForTypst: start');
    const scriptEl = document.getElementById('typst');

    if (globalThis.$typst) {
        markTiming('typst:wait:done');
        debugLog('waitForTypst: already available');
        return globalThis.$typst;
    }

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timed out loading Typst runtime'));
        }, 30000);

        const done = () => {
            clearTimeout(timeout);
            resolve();
        };

        if (scriptEl && scriptEl.addEventListener) {
            scriptEl.addEventListener('load', done, { once: true });
            scriptEl.addEventListener(
                'error',
                () => {
                    clearTimeout(timeout);
                    reject(new Error('Failed to load Typst runtime'));
                },
                { once: true },
            );
        } else {
            // Fallback: poll for the global instance
            const interval = setInterval(() => {
                if (globalThis.$typst) {
                    clearInterval(interval);
                    done();
                }
            }, 50);
        }
    });

    if (!globalThis.$typst) {
        throw new Error('Typst runtime loaded but $typst is missing');
    }
    markTiming('typst:wait:done');
    debugLog('waitForTypst: ready');
    return globalThis.$typst;
}

/**
 * Fetch markdown document from URL
 */
async function fetchMarkdown(url) {
    try {
        markTiming('fetch:start');
        updateStatus(`Fetching markdown from: ${url}`);
        debugLog('fetchMarkdown: start', url);

        const response = await fetchWithCache(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const content = await response.text();
        markTiming('fetch:done');
        debugLog('fetchMarkdown: done', { bytes: content.length });
        return content;
    } catch (error) {
        console.error('Failed to fetch markdown:', error);
        throw new Error('Failed to fetch markdown: ' + error.message);
    }
}

/**
 * Compile markdown to PDF
 */
async function compileToPDF(markdownContent, documentUrl = null) {
    try {
        markTiming('compile:start');
        debugLog('compileToPDF: start', { documentUrl });
        updateStatus('Parsing frontmatter...');

        const { metadata: fmMetadata, content } = parseFrontmatter(markdownContent);
        const sanitizedContent = closeUnclosedBacktickFence(content);

        const explicitSidecarUrl = urlParams.get('sidecar');
        const sidecar = await loadSidecar({ srcUrl: documentUrl, explicitSidecarUrl });
        if (sidecar?.url) {
            debugLog('sidecar: loaded', { url: sidecar.url });
        }
        lastSidecarUrl = sidecar?.url || null;

        const metadata = {
            ...(fmMetadata || {}),
            ...(sidecar?.metadata || {}),
        };

        updateStatus('Preparing Mermaid diagrams...');
        markTiming('mermaid:start');
        const { transformedMarkdown, svgAssets } = await renderMermaidBlocksToSvgAssets(sanitizedContent, {
            markTiming,
            debugLog,
            updateStatus,
        });
        markTiming('mermaid:done');
        debugLog('mermaid: done', { assets: svgAssets.length });

        updateStatus('Compiling to PDF with Typst WASM...');
        const $typst = await waitForTypst();
        markTiming('typst:ready');
        debugLog('typst: ready');

        // Configure package registry before the compiler initializes.
        await ensureTypstPackageRegistry($typst);

        // Ensure a clean slate across renders
        if (typeof $typst.resetShadow === 'function') {
            await $typst.resetShadow();
        }

        const encoder = new TextEncoder();

        // Optional Typst styling template (sidecar-controlled).
        // Sidecars are native Typst snippets. We inline them into the generated Typst preamble
        // so they run in the same scope as the injected `mdtypst` metadata dictionary.
        const templateText = sidecar?.typst?.templateText;
        const hasTemplate = Boolean(templateText && String(templateText).trim());
        lastTemplateUrl = hasTemplate ? sidecar?.url || null : null;
        const nativeTemplateMode = hasTemplate;

        // Mount mermaid SVG assets so Typst can `image("/assets/...")`
        if (typeof $typst.mapShadow === 'function') {
            for (const asset of svgAssets) {
                await $typst.mapShadow(asset.path, encoder.encode(asset.svg));
            }
        }

        const jpegParam = urlParams.get('jpeg');
        const userJpegMode = jpegParam === 'transcode' ? 'transcode' : 'native';

        const buildMarkdownForTypst = async ({ jpegMode }) => {
            return await mountAndRewriteImages(transformedMarkdown, documentUrl, $typst, {
                markTiming,
                debugLog,
                incCounter,
                timings,
                jpegMode,
            });
        };

        // Fetch + mount external/local images into shadow FS and rewrite Markdown to those paths.
        let markdownForTypst = await buildMarkdownForTypst({ jpegMode: userJpegMode });

        debugLog('images: mounted', {
            total: timings.counters.imagesTotal ?? 0,
            mounted: timings.counters.imagesMounted ?? 0,
            failed: timings.counters.imagesFailed ?? 0,
        });

        const tablesParam = urlParams.get('tables');
        const tableMode = tablesParam === '1' || tablesParam === 'tablem' ? 'tablem' : 'cmarker';

        const extraPreambleParts = [];
        if (hasTemplate) {
            extraPreambleParts.push(String(templateText).trim());
        }
        const extraPreamble = extraPreambleParts.length ? `${extraPreambleParts.join('\n\n')}\n\n` : '';

        const rendererParam = urlParams.get('renderer');
        const rendererMode = rendererParam || 'auto';

        // Heuristic: remote markdown often can't use @preview package imports on GH Pages.
        // Default to the fallback renderer for remote sources to avoid a slow failed attempt.
        let useFallback = rendererMode === 'fallback';
        if (rendererMode === 'cmarker') {
            useFallback = false;
        }
        if (!useFallback && rendererMode === 'auto') {
            try {
                const docOrigin = documentUrl ? new URL(documentUrl, window.location.href).origin : null;
                if (docOrigin && docOrigin !== window.location.origin) {
                    useFallback = true;
                }
            } catch {
                // ignore
            }
        }

        if (!useFallback && !cmarkerAvailable && !noFallback) useFallback = true;

        debugLog('renderer: selected', {
            useFallback,
            cmarkerAvailable,
            rendererMode,
            remoteDoc: (() => {
                try {
                    const docOrigin = documentUrl ? new URL(documentUrl, window.location.href).origin : null;
                    return Boolean(docOrigin && docOrigin !== window.location.origin);
                } catch {
                    return null;
                }
            })(),
        });

        updateStatus('Converting Markdown to Typst...');
        markTiming('typst:convert:start');
        let typstContent;
        if (useFallback) {
            typstContent = markdownToTypstFallback(markdownForTypst, metadata, documentUrl, {
                extraPreamble,
                includeMetadataPrelude: !nativeTemplateMode,
            });
        } else {
            // Performance: for the default cmarker mode, avoid embedding large Markdown content
            // as a huge string literal inside the Typst source. Instead, mount the Markdown
            // into the shadow FS and let Typst read it.
            const canMountMarkdown =
                tableMode !== 'tablem' &&
                typeof $typst.mapShadow === 'function' &&
                typeof encoder?.encode === 'function';

            let markdownPath = null;
            if (canMountMarkdown) {
                try {
                    markdownPath = '/mdtypst/input.md';
                    await $typst.mapShadow(markdownPath, encoder.encode(String(markdownForTypst)));
                } catch {
                    markdownPath = null;
                }
            }

            typstContent = markdownToTypstWithCmarker(markdownForTypst, metadata, {
                tableMode,
                extraPreamble,
                includeMetadataPrelude: !nativeTemplateMode,
                markdownPath,
            });
        }
        markTiming('typst:convert:done');

        lastTypstSource = typstContent;

        try {
            markTiming('pdf:compile:start');
            const pdfData = await $typst.pdf({ mainContent: typstContent });
            markTiming('pdf:compiled');
            debugLog('pdf: compiled', {
                bytes: pdfData?.byteLength ?? pdfData?.length ?? null,
                ms: (() => {
                    const m = timings.marks;
                    return m['pdf:compile:start'] != null && m['pdf:compiled'] != null
                        ? Math.round(m['pdf:compiled'] - m['pdf:compile:start'])
                        : null;
                })(),
            });
            return pdfData;
        } catch (err) {
            // If JPEG handling is the problem, retry once with JPEG transcoding.
            // This keeps the default fast path (native JPEG) while preserving compatibility.
            const hadJpeg = Boolean((timings?.counters?.imagesJpegCount ?? 0) > 0);
            const alreadyTranscoding = userJpegMode === 'transcode' || (timings?.counters?.imagesJpegTranscoded ?? 0) > 0;
            if (hadJpeg && !alreadyTranscoding) {
                updateStatus('Retrying with JPEG transcoding...');
                try {
                    markdownForTypst = await buildMarkdownForTypst({ jpegMode: 'transcode' });

                    markTiming('typst:convert:start');
                    if (useFallback) {
                        typstContent = markdownToTypstFallback(markdownForTypst, metadata, documentUrl, {
                            extraPreamble,
                            includeMetadataPrelude: !nativeTemplateMode,
                        });
                    } else {
                        const canMountMarkdown =
                            tableMode !== 'tablem' &&
                            typeof $typst.mapShadow === 'function' &&
                            typeof encoder?.encode === 'function';

                        let markdownPath = null;
                        if (canMountMarkdown) {
                            try {
                                markdownPath = '/mdtypst/input.md';
                                await $typst.mapShadow(markdownPath, encoder.encode(String(markdownForTypst)));
                            } catch {
                                markdownPath = null;
                            }
                        }

                        typstContent = markdownToTypstWithCmarker(markdownForTypst, metadata, {
                            tableMode,
                            extraPreamble,
                            includeMetadataPrelude: !nativeTemplateMode,
                            markdownPath,
                        });
                    }
                    markTiming('typst:convert:done');
                    lastTypstSource = typstContent;

                    markTiming('pdf:compile:start');
                    const pdfData = await $typst.pdf({ mainContent: typstContent });
                    markTiming('pdf:compiled');
                    debugLog('pdf: compiled (jpeg transcode retry)', {
                        bytes: pdfData?.byteLength ?? pdfData?.length ?? null,
                    });
                    return pdfData;
                } catch {
                    // If it still fails, continue with the existing error handling path.
                }
            }

            if (useFallback || noFallback) {
                throw err;
            }

            console.warn('Typst compilation failed; retrying with fallback renderer.', err);
            try {
                const msg = String(err?.message ?? err).toLowerCase();
                if (msg.includes('unresolved import')) {
                    cmarkerAvailable = false;
                }
            } catch {
                // ignore
            }

            updateStatus('Retrying with fallback renderer...');
            typstContent = markdownToTypstFallback(markdownForTypst, metadata, documentUrl, {
                extraPreamble,
                includeMetadataPrelude: !nativeTemplateMode,
            });
            lastTypstSource = typstContent;
            markTiming('pdf:compile:start');
            const pdfData = await $typst.pdf({ mainContent: typstContent });
            markTiming('pdf:compiled');
            debugLog('pdf: compiled (fallback)', {
                bytes: pdfData?.byteLength ?? pdfData?.length ?? null,
                ms: (() => {
                    const m = timings.marks;
                    return m['pdf:compile:start'] != null && m['pdf:compiled'] != null
                        ? Math.round(m['pdf:compiled'] - m['pdf:compile:start'])
                        : null;
                })(),
            });
            return pdfData;
        }
    } catch (error) {
        console.error('Failed to compile PDF:', error);
        throw new Error('Failed to compile PDF: ' + error.message);
    }
}

/**
 * Display PDF in viewer
 */
function displayPDF(pdfData) {
    try {
        pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Mark when the PDF viewer actually finishes loading the blob URL.
        // This is useful for performance measurement (time-to-visible) and differs from compile time.
        try {
            const onLoad = () => {
                markTiming('pdf:viewerLoaded');
                pdfViewer.removeEventListener('load', onLoad);
            };
            pdfViewer.addEventListener('load', onLoad);
        } catch {
            // ignore
        }
        
        pdfViewer.src = pdfUrl;
        pdfContainer.style.display = 'block';
        
        markTiming('pdf:displayed');
        updateStatus('PDF rendered successfully!', 'success');
    } catch (error) {
        console.error('Failed to display PDF:', error);
        throw new Error('Failed to display PDF: ' + error.message);
    }
}

/**
 * Handle PDF download
 */
function downloadPDF() {
    if (!pdfBlob) return;
    
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Main initialization and rendering pipeline
 */
async function main() {
    try {
        // Get URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const srcUrl = urlParams.get('src');
        
        if (!srcUrl) {
            updateStatus('No source URL provided. Use ?src=URL to specify a markdown document.', 'error');
            return;
        }
        
        // Fetch markdown
        const markdownContent = await fetchMarkdown(srcUrl);
        
        // Compile to PDF
        const pdfData = await compileToPDF(markdownContent, srcUrl);
        
        // Display PDF
        displayPDF(pdfData);
        
        // Setup download button
        downloadBtn.addEventListener('click', downloadPDF);
        
    } catch (error) {
        updateStatus(error.message, 'error');
        console.error('Error:', error);
    }
}

// Start the application
main();

// Minimal test hooks for CLI fixture runner (headless browser).
// Safe to expose: it only reads current state and can trigger compilation.
globalThis.__mdtypst = {
    getStatusText: () => statusEl?.textContent ?? '',
    getPdfBlob: () => pdfBlob,
    getTypstSource: () => lastTypstSource,
    getSidecarUrl: () => lastSidecarUrl,
    getTemplateUrl: () => lastTemplateUrl,
    getTimings: () => timings,
    compileToPDF,
    displayPDF,
};
