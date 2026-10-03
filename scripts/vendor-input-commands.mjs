// One dependency-free official composer parser; no UI services are transplanted.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = resolve(process.argv[2] ?? '../reference/ZCode');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (revision !== '29628c9acdb81b703bbd4080c207a0e7ce5e276e') throw Error('Unexpected reference revision');
const path = 'packages/ui/src/v4/slashCommands.ts';
const source = resolve(root, path);
const out = 'packages/client/vendor/zcode';
const bundle = await build({ stdin: { contents: `export {parseV4VisibleSlashCommand} from '${source}';`, loader: 'ts' }, bundle: true, format: 'esm', platform: 'neutral', write: false, plugins: [{ name: 'bounded-parser', setup(b) { b.onResolve({ filter: /.*/ }, args => { if (args.path !== source) throw Error('Unexpected parser dependency'); return { path: source }; }); } }], banner: { js: `/*! Derived from ZCode @${revision}; Copyright 2026 Z.AI Co., Ltd. Apache-2.0 (LICENSE). Modified: selective ESM parser, TypeScript erased; see SOURCES.json. */` } });
await mkdir(out, { recursive: true });
await writeFile(`${out}/input-commands.mjs`, bundle.outputFiles[0].contents);
await writeFile(`${out}/SOURCES.json`, JSON.stringify({ repository: 'https://github.com/zai-org/ZCode', revision, license: 'Apache-2.0', source: path, sha256: createHash('sha256').update(await readFile(source)).digest('hex'), exports: ['parseV4VisibleSlashCommand'] }, null, 2) + '\n');
for (const file of ['LICENSE', 'NOTICE.md']) await writeFile(`${out}/${file}`, await readFile(`${root}/${file}`));
