#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryAnalyzer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const simple_git_1 = __importDefault(require("simple-git"));
const timeline_analyzer_1 = require("./timeline-analyzer");
const full_delta_analyzer_1 = require("./full-delta-analyzer");
class RepositoryAnalyzer {
    constructor(repoPath) {
        this.repoPath = path.resolve(repoPath);
        this.git = (0, simple_git_1.default)(this.repoPath);
    }
    /**
     * Count non-blank lines in file content
     */
    countLinesOfCode(content) {
        const lines = content.split('\n');
        return lines.filter(line => line.trim().length > 0).length;
    }
    /**
     * Get file extension
     */
    getExtension(filePath) {
        const ext = path.extname(filePath);
        return ext.length > 0 ? ext.substring(1) : 'no-extension';
    }
    /**
     * Check if file path matches generated/minified file patterns
     * Phase 1.6: Expanded pattern coverage for common generated files
     */
    isGeneratedFile(filePath) {
        // Normalize path separators and ensure leading slash for pattern matching
        const normalizedPath = '/' + filePath.replace(/\\/g, '/');
        const patterns = [
            // Minified files
            '.min.js',
            '.min.css',
            // Build output directories
            '/dist/',
            '/build/',
            '/out/',
            '/node_modules/',
            '/vendor/',
            // Bundled files
            '.bundle.js',
            '/bundle.js',
            '/__generated__/',
            // Lock files (Phase 1.6)
            'yarn.lock',
            'package-lock.json',
            'pnpm-lock.yaml',
            'composer.lock',
            'Gemfile.lock',
            'Cargo.lock',
            'poetry.lock',
            'Pipfile.lock',
            // Build artifacts (Phase 1.6)
            '.map', // Source maps
            // Test artifacts (Phase 1.6)
            '/__snapshots__/', // Jest snapshot directories
            '.snap', // Jest snapshot files
            '/__compiled__/' // Compiled test fixtures
        ];
        return patterns.some(pattern => normalizedPath.includes(pattern));
    }
    /**
     * Get git metadata for a file (all metrics for visualization)
     */
    async getGitMetadata(filePath) {
        try {
            // Get full git log for this file (--follow to track renames)
            const log = await this.git.log({ file: filePath, '--follow': null });
            if (log.all.length > 0 && log.latest) {
                const latest = log.latest;
                const oldest = log.all[log.all.length - 1];
                // Get unique contributors
                const uniqueAuthors = new Set(log.all.map(commit => commit.author_name));
                // Get numstat data for lines changed calculations
                const numstatLog = await this.git.raw([
                    'log',
                    '--numstat',
                    '--follow',
                    '--',
                    filePath
                ]);
                // Parse numstat output to calculate line change metrics
                let totalLinesChanged = 0;
                let recentLinesChanged = 0;
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                const lines = numstatLog.split('\n');
                let currentCommitDate = null;
                for (const line of lines) {
                    // Date line format: "Date:   Thu Jan 18 12:00:00 2024 -0800"
                    if (line.startsWith('Date:')) {
                        const dateStr = line.substring(5).trim();
                        currentCommitDate = new Date(dateStr);
                    }
                    // Numstat line format: "10\t5\tfilepath.ts"
                    const numstatMatch = line.match(/^(\d+|-)\t(\d+|-)\t/);
                    if (numstatMatch && currentCommitDate) {
                        const added = numstatMatch[1] === '-' ? 0 : parseInt(numstatMatch[1]);
                        const deleted = numstatMatch[2] === '-' ? 0 : parseInt(numstatMatch[2]);
                        const linesChanged = added + deleted;
                        totalLinesChanged += linesChanged;
                        // Check if commit is within last 90 days
                        if (currentCommitDate >= ninetyDaysAgo) {
                            recentLinesChanged += linesChanged;
                        }
                    }
                }
                // Calculate average lines per commit
                const avgLinesPerCommit = log.total > 0 ? Math.round(totalLinesChanged / log.total) : 0;
                // Calculate days since last modified
                const lastModifiedDate = new Date(latest.date);
                const now = new Date();
                const daysSinceLastModified = Math.floor((now.getTime() - lastModifiedDate.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    lastModified: latest.date,
                    lastAuthor: latest.author_name,
                    lastCommitHash: latest.hash,
                    lastCommitMessage: latest.message,
                    commitCount: log.total,
                    contributorCount: uniqueAuthors.size,
                    firstCommitDate: oldest.date,
                    recentLinesChanged: recentLinesChanged,
                    avgLinesPerCommit: avgLinesPerCommit,
                    daysSinceLastModified: daysSinceLastModified
                };
            }
        }
        catch (error) {
            console.log(`Could not get git history for ${filePath}`);
        }
        return {
            lastModified: null,
            lastAuthor: null,
            lastCommitHash: null,
            lastCommitMessage: null,
            commitCount: null,
            contributorCount: null,
            firstCommitDate: null,
            recentLinesChanged: null,
            avgLinesPerCommit: null,
            daysSinceLastModified: null
        };
    }
    /**
     * Read all files at HEAD
     */
    async getFilesAtHead() {
        const files = await this.git.raw(['ls-tree', '-r', 'HEAD', '--name-only']);
        const fileList = files.trim().split('\n').filter((f) => f.length > 0);
        const fileInfos = [];
        for (const filePath of fileList) {
            try {
                const fullPath = path.join(this.repoPath, filePath);
                // Skip binary files and very large files
                const stats = fs.statSync(fullPath);
                if (stats.size > 1024 * 1024) { // Skip files > 1MB
                    console.log(`Skipping large file: ${filePath}`);
                    continue;
                }
                const content = fs.readFileSync(fullPath, 'utf-8');
                fileInfos.push({ path: filePath, content });
            }
            catch (error) {
                console.log(`Could not read file ${filePath}, skipping`);
            }
        }
        return fileInfos;
    }
    /**
     * Build hierarchical tree structure from flat file list
     */
    buildTree(files) {
        const root = {
            path: '',
            name: 'root',
            type: 'directory',
            children: []
        };
        for (const file of files) {
            const parts = file.path.split('/');
            let currentNode = root;
            // Navigate/create directory structure
            for (let i = 0; i < parts.length - 1; i++) {
                const dirName = parts[i];
                const dirPath = parts.slice(0, i + 1).join('/');
                let dirNode = currentNode.children.find(child => child.type === 'directory' && child.name === dirName);
                if (!dirNode) {
                    dirNode = {
                        path: dirPath,
                        name: dirName,
                        type: 'directory',
                        children: []
                    };
                    currentNode.children.push(dirNode);
                }
                currentNode = dirNode;
            }
            // Add file node
            const fileName = parts[parts.length - 1];
            const fileNode = {
                path: file.path,
                name: fileName,
                type: 'file',
                loc: file.loc,
                extension: this.getExtension(fileName),
                lastModified: file.lastModified,
                lastAuthor: file.lastAuthor,
                lastCommitHash: file.lastCommitHash,
                commitCount: file.commitCount,
                contributorCount: file.contributorCount,
                firstCommitDate: file.firstCommitDate,
                recentLinesChanged: file.recentLinesChanged,
                avgLinesPerCommit: file.avgLinesPerCommit,
                daysSinceLastModified: file.daysSinceLastModified,
                isGenerated: file.isGenerated
            };
            currentNode.children.push(fileNode);
        }
        return root;
    }
    /**
     * Analyze repository at HEAD
     */
    async analyze() {
        console.log(`Analyzing repository: ${this.repoPath}`);
        // Get HEAD commit info
        const log = await this.git.log({ maxCount: 1 });
        const headCommit = log.latest;
        if (!headCommit) {
            throw new Error('No commits found in repository');
        }
        console.log(`HEAD commit: ${headCommit.hash}`);
        console.log(`Reading files...`);
        // Get all files and calculate LOC
        const fileInfos = await this.getFilesAtHead();
        console.log(`Found ${fileInfos.length} files`);
        // Calculate LOC and get git metadata for each file
        console.log('Collecting git metadata...');
        const filesWithMetadata = [];
        const commitMessages = {};
        let generatedFileCount = 0;
        for (let i = 0; i < fileInfos.length; i++) {
            const f = fileInfos[i];
            const metadata = await this.getGitMetadata(f.path);
            const isGenerated = this.isGeneratedFile(f.path);
            if (isGenerated) {
                generatedFileCount++;
            }
            filesWithMetadata.push({
                path: f.path,
                loc: this.countLinesOfCode(f.content),
                lastModified: metadata.lastModified,
                lastAuthor: metadata.lastAuthor,
                lastCommitHash: metadata.lastCommitHash,
                commitCount: metadata.commitCount,
                contributorCount: metadata.contributorCount,
                firstCommitDate: metadata.firstCommitDate,
                recentLinesChanged: metadata.recentLinesChanged,
                avgLinesPerCommit: metadata.avgLinesPerCommit,
                daysSinceLastModified: metadata.daysSinceLastModified,
                isGenerated: isGenerated || undefined // Only include if true
            });
            // Collect unique commit messages
            if (metadata.lastCommitHash && metadata.lastCommitMessage) {
                if (!commitMessages[metadata.lastCommitHash]) {
                    commitMessages[metadata.lastCommitHash] = metadata.lastCommitMessage;
                }
            }
            // Progress indicator for large repos
            if ((i + 1) % 100 === 0) {
                console.log(`  Processed ${i + 1}/${fileInfos.length} files...`);
            }
        }
        // Report generated file detection
        if (generatedFileCount > 0) {
            console.log(`Detected ${generatedFileCount} generated/minified files (node_modules, dist, build, etc.)`);
        }
        // Build tree structure
        console.log('Building tree structure...');
        const tree = this.buildTree(filesWithMetadata);
        // Calculate stats
        const totalLoc = filesWithMetadata.reduce((sum, f) => sum + f.loc, 0);
        const filesByExtension = {};
        for (const file of filesWithMetadata) {
            const ext = this.getExtension(file.path);
            filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
        }
        console.log(`Collected ${Object.keys(commitMessages).length} unique commit messages`);
        const snapshot = {
            repositoryPath: this.repoPath,
            commit: headCommit.hash,
            timestamp: headCommit.date,
            author: headCommit.author_name,
            message: headCommit.message,
            tree,
            commitMessages,
            stats: {
                totalFiles: filesWithMetadata.length,
                totalLoc,
                filesByExtension
            }
        };
        console.log(`Analysis complete: ${totalLoc} total LOC across ${filesWithMetadata.length} files`);
        return snapshot;
    }
}
exports.RepositoryAnalyzer = RepositoryAnalyzer;
/**
 * Main entry point
 */
async function main() {
    const args = process.argv.slice(2);
    // Parse flags
    let timelineMode = false;
    let fullDeltaMode = false;
    let targetCommitCount = 200;
    const positionalArgs = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--timeline') {
            timelineMode = true;
        }
        else if (arg === '--full-delta') {
            fullDeltaMode = true;
        }
        else if (arg === '--target-commits') {
            targetCommitCount = parseInt(args[++i], 10);
        }
        else if (!arg.startsWith('--')) {
            positionalArgs.push(arg);
        }
    }
    const repoPath = positionalArgs[0] || process.cwd();
    const outputPath = positionalArgs[1] || path.join(__dirname, '../output/repo-data.json');
    try {
        if (fullDeltaMode) {
            // Full Delta mode: Generate timeline with ALL commits as deltas
            console.log('=== FULL DELTA MODE (Timeline) ===\n');
            const analyzer = new full_delta_analyzer_1.FullDeltaAnalyzer(repoPath);
            const timelineData = await analyzer.analyzeFullDelta();
            // Determine output path
            const repoName = path.basename(repoPath);
            const timelineOutputPath = path.join(__dirname, `../output/${repoName}-timeline-full.json`);
            // Ensure output directory exists
            const outputDir = path.dirname(timelineOutputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            // Write output
            fs.writeFileSync(timelineOutputPath, JSON.stringify(timelineData, null, 2));
            const fileSizeMB = (fs.statSync(timelineOutputPath).size / (1024 * 1024)).toFixed(2);
            console.log(`\n✅ Output written to: ${timelineOutputPath}`);
            console.log(`📦 File size: ${fileSizeMB} MB`);
            console.log(`\n📊 Timeline Stats:`);
            console.log(`  Format: ${timelineData.format}`);
            console.log(`  Total commits: ${timelineData.metadata.totalCommits}`);
            console.log(`  Date range: ${timelineData.metadata.dateRange.first.substring(0, 10)} to ${timelineData.metadata.dateRange.last.substring(0, 10)}`);
            console.log(`  Version tags: ${timelineData.metadata.tags.length}`);
            console.log(`  Commits with deltas: ${timelineData.commits.length}`);
            if (timelineData.metadata.tags.length > 0) {
                console.log(`\n🏷️  Tags: ${timelineData.metadata.tags.slice(0, 5).join(', ')}${timelineData.metadata.tags.length > 5 ? '...' : ''}`);
            }
        }
        else if (timelineMode) {
            // Timeline mode: Generate adaptive timeline with HEAD snapshot (V1)
            console.log('=== TIMELINE MODE (V1) ===');
            console.log(`Target commits: ${targetCommitCount}\n`);
            // First generate HEAD snapshot
            const analyzer = new RepositoryAnalyzer(repoPath);
            const headSnapshot = await analyzer.analyze();
            // Then generate timeline data
            const timelineAnalyzer = new timeline_analyzer_1.TimelineAnalyzer(repoPath);
            const timelineData = await timelineAnalyzer.analyzeTimeline(targetCommitCount, headSnapshot);
            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            // Write output
            fs.writeFileSync(outputPath, JSON.stringify(timelineData, null, 2));
            console.log(`Output written to: ${outputPath}`);
            console.log(`\nTimeline Stats:`);
            console.log(`  Total commits in repo: ${timelineData.timeline.totalCommits}`);
            console.log(`  Commits in base sampling: ${timelineData.timeline.baseSampling.actualCount}`);
            console.log(`  Date range: ${timelineData.timeline.dateRange.first} to ${timelineData.timeline.dateRange.last}`);
            console.log(`\nHEAD Snapshot Stats:`);
            console.log(`  Total files: ${timelineData.headSnapshot.stats.totalFiles}`);
            console.log(`  Total LOC: ${timelineData.headSnapshot.stats.totalLoc}`);
        }
        else {
            // Static mode: Generate HEAD snapshot only (backward compatible)
            const analyzer = new RepositoryAnalyzer(repoPath);
            const snapshot = await analyzer.analyze();
            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            // Write output
            fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
            console.log(`\nOutput written to: ${outputPath}`);
            console.log(`\nStats:`);
            console.log(`  Total files: ${snapshot.stats.totalFiles}`);
            console.log(`  Total LOC: ${snapshot.stats.totalLoc}`);
            console.log(`  Files by extension:`, snapshot.stats.filesByExtension);
        }
    }
    catch (error) {
        console.error('Error analyzing repository:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
