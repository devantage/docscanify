import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(
    (entry: { name: string; isDirectory(): boolean }): string[] => {
      const path: string = join(directory, entry.name);

      if (entry.isDirectory()) {
        return listSourceFiles(path);
      }

      return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
    },
  );
}

function listImports(path: string): string[] {
  return Array.from(
    readFileSync(path, 'utf8').matchAll(/from '([^']+)'/g),
    (match: RegExpMatchArray): string => match[1],
  );
}

describe('architecture', (): void => {
  it.each(listSourceFiles(join(__dirname, 'domain')))(
    'domain file %s imports only from the domain',
    (path: string): void => {
      expect(
        listImports(path).filter(
          (imported: string): boolean =>
            !imported.startsWith('.') || imported.includes('/adapters/'),
        ),
      ).toEqual([]);
    },
  );

  it.each(listSourceFiles(join(__dirname, 'domain')))(
    'domain file %s does not mention canvas or OpenCV',
    (path: string): void => {
      expect(readFileSync(path, 'utf8')).not.toMatch(
        /\bCanvas\b|\bcv\.|OpenCv/,
      );
    },
  );

  it.each(listSourceFiles(join(__dirname, 'adapters')))(
    'adapter %s does not import the entity',
    (path: string): void => {
      expect(
        listImports(path).filter((imported: string): boolean =>
          imported.includes('entities'),
        ),
      ).toEqual([]);
    },
  );

  it.each(
    ['canvas', 'decoders', 'encoders'].flatMap((folder: string): string[] =>
      listSourceFiles(join(__dirname, 'adapters', folder)),
    ),
  )('adapter %s does not depend on OpenCV', (path: string): void => {
    expect(
      listImports(path).filter((imported: string): boolean =>
        imported.includes('opencv'),
      ),
    ).toEqual([]);
  });
});
