const fs = require('fs-extra');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const CleanCSS = require('clean-css');
const minify = require('html-minifier-terser').minify;
const { minify: terserMinify } = require('terser');

const srcPublicPath = path.join(__dirname, '..', 'public');
const destPublicPath = path.join(__dirname, '..', 'dist', 'public');

async function build() {
    console.log('Starting build process...');

    // 1. Clean destination directory
    await fs.emptyDir(destPublicPath);
    console.log(`Cleaned destination: ${destPublicPath}`);

    // 2. Copy source to destination
    await fs.copy(srcPublicPath, destPublicPath);
    console.log(`Copied from ${srcPublicPath} to ${destPublicPath}`);

    // 3. Process files recursively
    async function processDirectory(dir) {
        const files = await fs.readdir(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                await processDirectory(filePath);
            } else {
                await processFile(filePath);
            }
        }
    }

    async function processFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();

        // Skip some files if necessary, e.g., already minified libraries
        if (filePath.includes('.min.js') || filePath.includes('.min.css')) {
            return;
        }

        try {
            if (ext === '.js') {
                const code = await fs.readFile(filePath, 'utf8');

                // 1. Minify using terser
                const minifiedJS = await terserMinify(code, {
                    compress: true,
                    mangle: true,
                    toplevel: false
                });

                // 2. Obfuscate the minified output
                const obfuscationResult = JavaScriptObfuscator.obfuscate(minifiedJS.code, {
                    compact: true,
                    controlFlowFlattening: true,
                    controlFlowFlatteningThreshold: 1, // High obfuscation
                    numbersToExpressions: true,
                    simplify: true,
                    stringArrayShuffle: true,
                    splitStrings: true,
                    stringArrayThreshold: 1,
                    disableConsoleOutput: true,
                    debugProtection: true, // Prevents devtools from working properly
                    debugProtectionInterval: 4000 // Repeatedly triggers debugger
                });
                await fs.writeFile(filePath, obfuscationResult.getObfuscatedCode());
                console.log(`Obfuscated and minified: ${filePath}`);
            } else if (ext === '.css') {
                const code = await fs.readFile(filePath, 'utf8');
                const minified = new CleanCSS({}).minify(code);
                await fs.writeFile(filePath, minified.styles);
                console.log(`Minified CSS: ${filePath}`);
            } else if (ext === '.html') {
                const code = await fs.readFile(filePath, 'utf8');
                const minified = await minify(code, {
                    collapseWhitespace: true,
                    removeComments: true,
                    minifyCSS: true,
                    minifyJS: true
                });
                await fs.writeFile(filePath, minified);
                console.log(`Minified HTML: ${filePath}`);
            }
        } catch (err) {
            console.error(`Error processing file ${filePath}:`, err);
        }
    }

    await processDirectory(destPublicPath);
    console.log('Build completed successfully.');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
