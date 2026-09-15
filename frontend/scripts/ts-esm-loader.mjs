import { readFile } from 'node:fs/promises';
import ts from 'typescript';

/**
 * Tiny Node 20-compatible ESM loader used only by validation scripts.
 * It transpiles imported TypeScript files in-memory with the project's
 * existing TypeScript dependency, so physics validation can execute the
 * exact production HurdleGenerator source without adding another runtime.
 */
export async function load(url, context, nextLoad) {
  if (!url.endsWith('.ts')) return nextLoad(url, context);

  const source = await readFile(new URL(url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
    fileName: new URL(url).pathname,
  });

  return {
    format: 'module',
    source: outputText,
    shortCircuit: true,
  };
}
