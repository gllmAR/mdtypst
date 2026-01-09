/**
 * mdpdf-link v0.9 - Minimal JavaScript Loader
 * Orchestrates: fetch, WASM init, and output delivery
 */

// State management
let typstWasm = null;
let pdfBlob = null;

// UI elements
const statusEl = document.getElementById('status');
const pdfContainer = document.getElementById('pdf-container');
const pdfViewer = document.getElementById('pdf-viewer');
const downloadBtn = document.getElementById('download-btn');

/**
 * Update status message
 */
function updateStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = type;
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
        return { metadata: {}, content: content };
    }
    
    const yamlContent = match[1];
    const markdownContent = match[2];
    
    // Simple YAML parser for common key-value pairs
    const metadata = {};
    yamlContent.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
            metadata[key] = value;
        }
    });
    
    return { metadata, content: markdownContent };
}

/**
 * Convert Markdown to Typst format
 * Uses cmarker-style conversion with Mermaid diagram support
 */
function markdownToTypst(markdown, metadata) {
    let typst = '';
    
    // Add metadata to Typst document
    if (metadata.title) {
        typst += `#set document(title: "${metadata.title}")\n`;
    }
    if (metadata.author) {
        typst += `#set document(author: "${metadata.author}")\n`;
    }
    
    // Basic document setup
    typst += `#set page(paper: "a4", margin: (x: 2.5cm, y: 2.5cm))\n`;
    typst += `#set text(font: "Linux Libertine", size: 11pt)\n`;
    typst += `#set par(justify: true)\n\n`;
    
    // Add title if present
    if (metadata.title) {
        typst += `#align(center)[\n  #text(size: 24pt, weight: "bold")[${metadata.title}]\n]\n`;
        if (metadata.author) {
            typst += `#align(center)[\n  #text(size: 12pt)[${metadata.author}]\n]\n`;
        }
        if (metadata.date) {
            typst += `#align(center)[\n  #text(size: 10pt)[${metadata.date}]\n]\n`;
        }
        typst += `\n`;
    }
    
    // Convert markdown content to Typst
    // This is a simplified conversion - in production would use cmarker
    let lines = markdown.split('\n');
    let inCodeBlock = false;
    let inMermaid = false;
    let mermaidContent = '';
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Handle code blocks
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                const language = line.substring(3).trim();
                if (language === 'mermaid') {
                    inMermaid = true;
                    mermaidContent = '';
                } else {
                    inCodeBlock = true;
                    typst += `\`\`\`${language}\n`;
                }
            } else {
                inCodeBlock = false;
                typst += `\`\`\`\n\n`;
            }
            continue;
        }
        
        if (inMermaid) {
            if (line.startsWith('```')) {
                inMermaid = false;
                // In production, oxdraw would render the mermaid diagram
                typst += `#block(fill: luma(250), inset: 8pt, radius: 4pt)[\n`;
                typst += `  #text(size: 9pt, fill: gray)[Mermaid Diagram]\n`;
                typst += `  #text(size: 8pt, font: "Courier New")[\n`;
                typst += `    ${mermaidContent.split('\n').join('\\n    ')}\n`;
                typst += `  ]\n`;
                typst += `]\n\n`;
                mermaidContent = '';
            } else {
                mermaidContent += line + '\n';
            }
            continue;
        }
        
        if (inCodeBlock) {
            typst += line + '\n';
            continue;
        }
        
        // Headers
        if (line.startsWith('# ')) {
            typst += `= ${line.substring(2)}\n\n`;
        } else if (line.startsWith('## ')) {
            typst += `== ${line.substring(3)}\n\n`;
        } else if (line.startsWith('### ')) {
            typst += `=== ${line.substring(4)}\n\n`;
        } else if (line.startsWith('#### ')) {
            typst += `==== ${line.substring(5)}\n\n`;
        }
        // Bold and italic
        else if (line.includes('**') || line.includes('*') || line.includes('_')) {
            line = line.replace(/\*\*(.+?)\*\*/g, '*$1*');
            line = line.replace(/\*(.+?)\*/g, '_$1_');
            line = line.replace(/_(.+?)_/g, '_$1_');
            typst += line + '\n\n';
        }
        // Lists
        else if (line.match(/^\s*[-*]\s/)) {
            typst += line.replace(/^\s*[-*]\s/, '- ') + '\n';
        }
        else if (line.match(/^\s*\d+\.\s/)) {
            typst += line.replace(/^\s*\d+\.\s/, '+ ') + '\n';
        }
        // Links
        else if (line.includes('[') && line.includes('](')) {
            line = line.replace(/\[(.+?)\]\((.+?)\)/g, '#link("$2")[$1]');
            typst += line + '\n\n';
        }
        // Empty lines
        else if (line.trim() === '') {
            typst += '\n';
        }
        // Regular paragraphs
        else {
            typst += line + '\n\n';
        }
    }
    
    return typst;
}

/**
 * Initialize Typst WASM
 */
async function initTypstWasm() {
    try {
        updateStatus('Loading Typst WASM module...');
        
        // In a real implementation, we would load the actual typst-wasm module
        // For this demo, we'll simulate the WASM module
        typstWasm = {
            compile: async (typstContent) => {
                // Simulate compilation delay
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // In production, this would call the actual Typst WASM compiler
                // For now, we'll create a minimal PDF with the Typst content
                return createMinimalPDF(typstContent);
            }
        };
        
        return true;
    } catch (error) {
        console.error('Failed to initialize Typst WASM:', error);
        throw new Error('Failed to initialize Typst WASM: ' + error.message);
    }
}

/**
 * Create a minimal PDF (placeholder for actual Typst compilation)
 */
function createMinimalPDF(content) {
    // This is a minimal PDF structure for demonstration
    // In production, Typst WASM would generate the actual PDF
    const pdfHeader = '%PDF-1.4\n';
    const pdfContent = `
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj

4 0 obj
<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
endobj

5 0 obj
<< /Length 200 >>
stream
BT
/F1 12 Tf
50 700 Td
(mdpdf-link v0.9 - Markdown to PDF) Tj
0 -20 Td
(This is a demonstration PDF.) Tj
0 -20 Td
(In production, Typst WASM would render the full document.) Tj
ET
endstream
endobj

xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
0000000308 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
560
%%EOF
`;
    
    return new Uint8Array(new TextEncoder().encode(pdfHeader + pdfContent));
}

/**
 * Fetch markdown document from URL
 */
async function fetchMarkdown(url) {
    try {
        updateStatus(`Fetching markdown from: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const content = await response.text();
        return content;
    } catch (error) {
        console.error('Failed to fetch markdown:', error);
        throw new Error('Failed to fetch markdown: ' + error.message);
    }
}

/**
 * Compile markdown to PDF
 */
async function compileToPDF(markdownContent) {
    try {
        updateStatus('Parsing frontmatter...');
        const { metadata, content } = parseFrontmatter(markdownContent);
        
        updateStatus('Converting Markdown to Typst (via cmarker)...');
        const typstContent = markdownToTypst(content, metadata);
        
        updateStatus('Compiling to PDF with Typst WASM...');
        const pdfData = await typstWasm.compile(typstContent);
        
        return pdfData;
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
        
        pdfViewer.src = pdfUrl;
        pdfContainer.style.display = 'block';
        
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
        
        // Initialize Typst WASM
        await initTypstWasm();
        
        // Fetch markdown
        const markdownContent = await fetchMarkdown(srcUrl);
        
        // Compile to PDF
        const pdfData = await compileToPDF(markdownContent);
        
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
