#!/usr/bin/env node
/**
 * Copies the canonical message bundles into the demo app assets.
 * samples/messages is the source of truth; the demo copy is generated and gitignored.
 */
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'samples', 'messages');
const target = join(root, 'projects', 'demo', 'public', 'assets');

await mkdir(target, { recursive: true });

const files = (await readdir(source)).filter((file) => file.endsWith('.json'));
await Promise.all(files.map((file) => copyFile(join(source, file), join(target, file))));

console.log(`sync-messages: copied ${files.length} bundle(s) to the demo assets.`);
