import depcheck from 'depcheck';

// Ignore packages that are defined here per package
const IGNORE_MATCHES = {
  '*': [],
};

export default async function getMissingDependencies(
  name: string,
  path: string,
  dependencies: JSON,
  peerDependencies: JSON,
  verbose: boolean,
) {
  const options: any = {
    /**
     * If a dependency is exclusively used via a TypeScript type import
     * e.g. `import type { Foo } from 'bar';`
     * ...then we do not want it to trigger a missing dependency warning
     * because it is not required at runtime.
     *
     * We can achieve this by overriding the default detector for
     * ImportDeclaration nodes to check the `importKind` value.
     */
    detectors: [
      ...Object.entries(depcheck.detector).map(([detectorName, detectorFn]) => {
        // Use all the default detectors, apart from 'importDeclaration'
        if (detectorName !== 'importDeclaration') {
          return detectorFn;
        }
        const customImportDeclarationDetector: depcheck.Detector = (node) => {
          return node.type === 'ImportDeclaration' && node.source && node.source.value && node.importKind !== 'type'
            ? [node.source.value]
            : [];
        };
        return customImportDeclarationDetector;
      }),
    ],
    skipMissing: false, // skip calculation of missing dependencies
    ignorePatterns: ['*.d.ts', '.eslintrc.json', '*.spec*', 'src/schematics/**/files/**', 'src/migrations/**'],
  };
  let { missing } = await depcheck(path, {
    ...options,
    package: { dependencies, peerDependencies },
  });

  const packagesMissing = Object.keys(missing).filter(
    (m) => !IGNORE_MATCHES['*'].includes(m) && !(IGNORE_MATCHES[name] || []).includes(m),
  );

  if (verbose) {
    console.log(`> ${name}`);
    packagesMissing.map((p) => {
      console.log(p, missing[p]);
    });
  }

  return packagesMissing;
}
