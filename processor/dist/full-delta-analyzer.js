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
exports.FullDeltaAnalyzer = void 0;
const simple_git_1 = __importDefault(require("simple-git"));
const path = __importStar(require("path"));
/**
 * Full Delta Analyzer - Extracts ALL commits as deltas (no sampling)
 * For delta-based tree reconstruction
 */
class FullDeltaAnalyzer {
    constructor(repoPath) {
        this.repoPath = path.resolve(repoPath);
        this.git = (0, simple_git_1.default)(this.repoPath);
    }
    /**
     * Analyze repository and generate timeline format
     */
    async analyzeFullDelta() {
        console.log(`\n🔍 Analyzing repository: ${this.repoPath}`);
        console.log('Extracting full commit history (no sampling)...\n');
        // 1. Get ALL commits
        const allCommits = await this.getAllCommits();
        console.log(`📊 Found ${allCommits.length} total commits`);
        // 2. Extract tags
        const tags = await this.extractAllTags();
        console.log(`🏷️  Found ${tags.length} version tags`);
        // 3. Build commit snapshots with deltas
        console.log(`\n⚙️  Building commit snapshots...`);
        const commitSnapshots = await this.buildCommitSnapshots(allCommits);
        console.log(`✅ Generated ${commitSnapshots.length} commit snapshots\n`);
        // 4. Build metadata
        const metadata = {
            totalCommits: allCommits.length,
            dateRange: {
                first: allCommits[0].date.toISOString(),
                last: allCommits[allCommits.length - 1].date.toISOString()
            },
            tags
        };
        return {
            format: 'timeline',
            repositoryPath: this.repoPath,
            metadata,
            commits: commitSnapshots
        };
    }
    /**
     * Get ALL commits in chronological order (oldest first)
     */
    async getAllCommits() {
        // Use raw git command for more control
        const result = await this.git.raw([
            'log',
            '--all',
            '--reverse', // Oldest first
            '--format=%H|%aI|%an|%s|%D' // hash|date|author|message|refs
        ]);
        const commits = [];
        const lines = result.split('\n').filter(l => l.trim());
        for (const line of lines) {
            const parts = line.split('|');
            if (parts.length >= 4) {
                commits.push({
                    hash: parts[0],
                    date: new Date(parts[1]),
                    author: parts[2],
                    message: parts[3],
                    refs: parts[4] || ''
                });
            }
        }
        return commits;
    }
    /**
     * Extract all git tags
     */
    async extractAllTags() {
        try {
            const tagList = await this.git.tags();
            return tagList.all || [];
        }
        catch (error) {
            console.warn('Could not extract tags:', error);
            return [];
        }
    }
    /**
     * Build CommitSnapshot objects with file change deltas
     */
    async buildCommitSnapshots(commits) {
        const snapshots = [];
        for (let i = 0; i < commits.length; i++) {
            const commit = commits[i];
            if (i % 100 === 0) {
                console.log(`  Processing commit ${i + 1}/${commits.length}...`);
            }
            // Extract file changes for this commit
            const changes = await this.extractFileChanges(commit.hash, i === 0);
            // Extract tags from refs (format: "tag: v1.0.0, tag: v1.0.1")
            const tags = this.parseTagsFromRefs(commit.refs);
            // Check if merge commit (has multiple parents)
            const isMergeCommit = await this.isMergeCommit(commit.hash);
            snapshots.push({
                hash: commit.hash,
                date: commit.date.toISOString(),
                author: commit.author,
                message: commit.message,
                tags,
                isMergeCommit,
                importanceScore: this.calculateImportanceScore(changes, tags, isMergeCommit),
                changes
            });
        }
        return snapshots;
    }
    /**
     * Extract file changes for a specific commit
     */
    async extractFileChanges(hash, isFirstCommit) {
        try {
            // For first commit, all files are "added"
            if (isFirstCommit) {
                const files = await this.getFilesInCommit(hash);
                return {
                    filesAdded: files,
                    filesModified: [],
                    filesDeleted: [],
                    totalFilesChanged: files.length,
                    linesAdded: 0, // Unknown for first commit
                    linesDeleted: 0
                };
            }
            // For other commits, use git show with --name-status and --numstat
            const nameStatus = await this.git.show([
                hash,
                '--name-status',
                '--format=',
                '--no-renames' // Treat renames as delete + add for simplicity
            ]);
            const numstat = await this.git.show([
                hash,
                '--numstat',
                '--format='
            ]);
            // Parse file changes
            const filesAdded = [];
            const filesModified = [];
            const filesDeleted = [];
            const lines = nameStatus.split('\n').filter(l => l.trim());
            for (const line of lines) {
                const parts = line.trim().split(/\t/); // Git uses TAB, not space!
                if (parts.length >= 2) {
                    const status = parts[0];
                    const filePath = parts[1];
                    // Skip binary files and submodules
                    if (!filePath || filePath.includes('Subproject commit'))
                        continue;
                    if (status === 'A') {
                        filesAdded.push(filePath);
                    }
                    else if (status === 'M') {
                        filesModified.push(filePath);
                    }
                    else if (status === 'D') {
                        filesDeleted.push(filePath);
                    }
                    else if (status.startsWith('R')) {
                        // Rename (shouldn't happen with --no-renames, but handle anyway)
                        if (parts.length >= 3) {
                            filesDeleted.push(parts[1]);
                            filesAdded.push(parts[2]);
                        }
                    }
                    else if (status.startsWith('C')) {
                        // Copy - treat as add
                        if (parts.length >= 3) {
                            filesAdded.push(parts[2]);
                        }
                    }
                    else if (status.startsWith('T')) {
                        // Type change (file<->symlink) - treat as modify
                        filesModified.push(filePath);
                    }
                    // Ignore other status codes (X, U for unmerged, etc.)
                }
            }
            // Parse line changes
            let linesAdded = 0;
            let linesDeleted = 0;
            const numstatLines = numstat.split('\n').filter(l => l.trim());
            for (const line of numstatLines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const added = parts[0] === '-' ? 0 : parseInt(parts[0]) || 0;
                    const deleted = parts[1] === '-' ? 0 : parseInt(parts[1]) || 0;
                    linesAdded += added;
                    linesDeleted += deleted;
                }
            }
            return {
                filesAdded,
                filesModified,
                filesDeleted,
                totalFilesChanged: filesAdded.length + filesModified.length + filesDeleted.length,
                linesAdded,
                linesDeleted
            };
        }
        catch (error) {
            console.warn(`Warning: Could not extract changes for ${hash}:`, error);
            return {
                filesAdded: [],
                filesModified: [],
                filesDeleted: [],
                totalFilesChanged: 0,
                linesAdded: 0,
                linesDeleted: 0
            };
        }
    }
    /**
     * Get list of all files in a specific commit (for first commit)
     */
    async getFilesInCommit(hash) {
        try {
            const result = await this.git.raw(['ls-tree', '-r', '--name-only', hash]);
            return result.split('\n').filter(f => f.trim().length > 0);
        }
        catch (error) {
            console.warn(`Warning: Could not list files for ${hash}:`, error);
            return [];
        }
    }
    /**
     * Check if commit is a merge commit
     */
    async isMergeCommit(hash) {
        try {
            const result = await this.git.raw(['rev-list', '--parents', '-n', '1', hash]);
            const parents = result.trim().split(/\s+/);
            return parents.length > 2; // More than 1 parent (first item is the commit itself)
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Parse tags from git refs string
     */
    parseTagsFromRefs(refs) {
        if (!refs)
            return [];
        const tags = [];
        const parts = refs.split(',').map(s => s.trim());
        for (const part of parts) {
            if (part.startsWith('tag: ')) {
                tags.push(part.substring(5).trim());
            }
        }
        return tags;
    }
    /**
     * Calculate importance score for commit
     */
    calculateImportanceScore(changes, tags, isMerge) {
        let score = 0;
        // Base score from changes
        score += changes.totalFilesChanged * 1;
        score += (changes.linesAdded + changes.linesDeleted) * 0.1;
        // Tag bonus
        if (tags.length > 0) {
            score += 100;
        }
        // Merge bonus
        if (isMerge) {
            score += 50;
        }
        return Math.round(score);
    }
}
exports.FullDeltaAnalyzer = FullDeltaAnalyzer;
