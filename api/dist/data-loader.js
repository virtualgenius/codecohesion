"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataLoader = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class DataLoader {
    constructor(dataDir) {
        // In production (Railway), dist/ is at api/dist/, so data/ is at api/data/
        // In development (ts-node), src/ is at api/src/, so data/ is at api/data/
        this.dataDir = dataDir || path_1.default.join(__dirname, '../data');
    }
    /**
     * List all available repositories from JSON files in data directory
     */
    async listRepos() {
        const files = await promises_1.default.readdir(this.dataDir);
        const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('.'));
        const repos = await Promise.all(jsonFiles.map(async (file) => {
            try {
                const data = await this.loadRepoFile(file);
                const item = {
                    id: this.fileToRepoId(file),
                    name: file.replace('.json', ''),
                    format: this.detectFormat(data)
                };
                return item;
            }
            catch (error) {
                console.error(`Failed to load ${file}:`, error);
                return null;
            }
        }));
        return repos.filter((r) => r !== null);
    }
    /**
     * Load repository data by ID
     */
    async loadRepo(repoId) {
        const file = await this.findFileByRepoId(repoId);
        if (!file) {
            throw new Error(`Repository not found: ${repoId}`);
        }
        return this.loadRepoFile(file);
    }
    /**
     * Find repository by GitHub URL
     */
    async findRepoByUrl(url) {
        // Extract repo name from URL
        // "https://github.com/facebook/react" → "react"
        const match = url.match(/\/([^\/]+?)(?:\.git)?$/);
        if (!match)
            return null;
        const repoName = match[1].toLowerCase();
        const repos = await this.listRepos();
        // Find repo whose ID contains the repo name
        const found = repos.find(r => r.id.toLowerCase().includes(repoName));
        if (!found)
            return null;
        return {
            ...found,
            url
        };
    }
    /**
     * Load and parse JSON file from data directory
     */
    async loadRepoFile(filename) {
        const filePath = path_1.default.join(this.dataDir, filename);
        const content = await promises_1.default.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }
    /**
     * Convert filename to repository ID
     */
    fileToRepoId(filename) {
        return filename.replace('.json', '').toLowerCase();
    }
    /**
     * Find file by repository ID
     */
    async findFileByRepoId(repoId) {
        const files = await promises_1.default.readdir(this.dataDir);
        return files.find(f => this.fileToRepoId(f) === repoId.toLowerCase()) || null;
    }
    /**
     * Detect format from data structure
     */
    detectFormat(data) {
        if ('format' in data) {
            return data.format;
        }
        return 'static';
    }
}
exports.DataLoader = DataLoader;
