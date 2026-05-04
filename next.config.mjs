import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Pin the workspace root to this project to silence the
  // "multiple lockfiles detected" warning when a stray lockfile
  // exists in a parent directory.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
