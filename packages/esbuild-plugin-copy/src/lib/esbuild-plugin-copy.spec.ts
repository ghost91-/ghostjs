import { copy } from './esbuild-plugin-copy';

import { bold, green, yellow } from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { replaceInFile as replace } from 'replace-in-file';
import { build } from 'esbuild';
import type { IOptions } from './types';

const encoding = 'utf-8';
const fixtures = `${__dirname}/fixtures`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, encoding);
}

async function doBuild(options?: IOptions, { watch = false } = {}) {
  return build({
    absWorkingDir: fixtures,
    entryPoints: [`src/index.js`],
    outdir: `dist`,
    plugins: [copy(options)],
    watch,
  });
}

afterEach(async () => {
  await fs.remove(`${fixtures}/dist`);
  await fs.remove(`${fixtures}/build`);
});

describe('copy', () => {
  it("shouldn't do anything when no options are passed", async () => {
    await doBuild();

    expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(false);
  });

  it("shouldn't do anything when targets are empty", async () => {
    await doBuild({ targets: [] });

    expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(false);
  });

  it('should copy files', async () => {
    await doBuild({
      targets: [{ src: ['src/assets/asset-1.js', 'src/assets/asset-2.js'], dest: 'dist' }],
    });

    expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/asset-2.js`)).toBe(true);
  });

  it('should copy folders recursively', async () => {
    await doBuild({
      targets: [
        {
          src: ['src/assets/css', 'src/assets/scss'],
          dest: 'dist',
        },
      ],
    });

    expect(fs.pathExistsSync(`${fixtures}/dist/css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css/css-1.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css/css-2.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss/scss-1.scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss/scss-2.scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss/nested`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss/nested/scss-3.scss`)).toBe(true);
  });

  it('should copy glob matched files', async () => {
    await doBuild({
      targets: [
        {
          src: ['src/assets/asset-{1,2}.js', 'src/assets/css/*.css', '!**/css-1.css', 'src/assets/scss/scss-?(1).scss'],
          dest: 'dist',
        },
      ],
    });

    expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/asset-2.js`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css-1.css`)).toBe(false);
    expect(fs.pathExistsSync(`${fixtures}/dist/css-2.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-1.scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-2.scss`)).toBe(false);
  });

  it('should handle multiple objects as targets', async () => {
    await doBuild({
      targets: [
        { src: ['src/assets/*', 'src/assets/css'], dest: 'dist' },
        { src: 'src/assets/css/*.css', dest: 'build' },
      ],
    });

    expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/asset-2.js`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css/css-1.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css/css-2.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/build/css-1.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/build/css-2.css`)).toBe(true);
  });

  it('should handle multiple destinations', async () => {
    await doBuild({
      targets: [
        {
          src: ['src/assets/asset-1.js', 'src/assets/css', 'src/assets/scss/scss-?(1).scss'],
          dest: ['dist', 'build'],
        },
      ],
    });

    expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css/css-1.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css/css-2.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-1.scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/build/asset-1.js`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/build/css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/build/css/css-1.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/build/css/css-2.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/build/scss-1.scss`)).toBe(true);
  });

  it('should handle the same target being specified multiple times gracefully', async () => {
    await doBuild({
      targets: [
        { src: 'src/assets/css', dest: 'dist' },
        { src: 'src/assets/css', dest: 'dist' },
        {
          src: ['src/assets/asset-1.js', 'src/assets/asset-1.js'],
          dest: 'build',
        },
      ],
    });

    expect(fs.pathExistsSync(`${fixtures}/dist/css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css/css-1.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css/css-2.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/build/asset-1.js`)).toBe(true);
  });

  it('should throw if a target is not an object', async () => {
    await expect(
      doBuild({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targets: ['src/assets/asset-1.js'] as any,
      }),
    ).rejects.toThrow("'src/assets/asset-1.js' target must be an object");
  });

  it("should throw if target object doesn't have required properties", async () => {
    await expect(
      doBuild({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targets: [{ src: 'src/assets/asset-1.js' }] as any,
      }),
    ).rejects.toThrow('{ src: \'src/assets/asset-1.js\' } target must have "src" and "dest" properties');
  });

  it('should throw if target object "rename" property is of wrong type', async () => {
    await expect(
      doBuild({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targets: [{ src: 'src/assets/asset-1.js', dest: 'dist', rename: [] as any }],
      }),
    ).rejects.toThrow(
      "{ src: 'src/assets/asset-1.js', dest: 'dist', rename: [] }" +
        ' target\'s "rename" property must be a string or a function',
    );
  });

  it('should rename targets if configured to do so', async () => {
    await doBuild({
      targets: [
        {
          src: 'src/assets/asset-1.js',
          dest: 'dist',
          rename: 'asset-1-renamed.js',
        },
        { src: 'src/assets/css', dest: 'dist', rename: 'css-renamed' },
        {
          src: 'src/assets/css/*',
          dest: 'dist/css-multiple',
          rename: 'css-1.css',
        },
        {
          src: 'src/assets/asset-2.js',
          dest: 'dist',
          rename: (name: string, extension: string) => `${name}-renamed.${extension}`,
        },
        {
          src: 'src/assets/scss',
          dest: 'dist',
          rename: (name: string) => `${name}-renamed`,
        },
        {
          src: 'src/assets/scss/*',
          dest: 'dist/scss-multiple',
          rename: (name: string, extension: string) => (extension ? `${name}-renamed.${extension}` : `${name}-renamed`),
        },
        {
          src: 'src/assets/asset-1.js',
          dest: 'dist',
          rename: (_: string, __: string, fullPath: string) => path.basename(fullPath).replace('1', '3'),
        },
      ],
    });

    expect(fs.pathExistsSync(`${fixtures}/dist/asset-1-renamed.js`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css-renamed`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css-renamed/css-1.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css-renamed/css-2.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css-multiple/css-1.css`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/css-multiple/css-2.css`)).toBe(false);
    expect(fs.pathExistsSync(`${fixtures}/dist/asset-2-renamed.js`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-renamed`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-renamed/scss-1.scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-renamed/scss-2.scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-renamed/nested`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-renamed/nested/scss-3.scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-multiple/scss-1-renamed.scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-multiple/scss-2-renamed.scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-multiple/nested-renamed`)).toBe(true);
    expect(await fs.pathExists(`${fixtures}/dist/scss-multiple/nested-renamed/scss-3.scss`)).toBe(true);
    expect(fs.pathExistsSync(`${fixtures}/dist/asset-3.js`)).toBe(true);
  });

  it('should throw if target to be transformed is not a file', async () => {
    await expect(
      doBuild({
        targets: [
          {
            src: 'src/assets/css',
            dest: 'dist',
            transform: (contents: string | ArrayBuffer) => contents.toString().replace('blue', 'red'),
          },
        ],
      }),
    ).rejects.toThrow('"transform" option works only on files: \'src/assets/css\' must be a file');
  });

  it('should transform the target if configured to do so', async () => {
    await doBuild({
      targets: [
        {
          src: 'src/assets/css/css-1.css',
          dest: ['dist', 'build'],
          transform: (contents: string | ArrayBuffer) => contents.toString().replace('blue', 'red'),
        },
        {
          src: 'src/assets/scss/**/*.scss',
          dest: 'dist',
          transform: (contents: string | ArrayBuffer) => contents.toString().replace('background-color', 'color'),
        },
        {
          src: 'src/assets/css/css-1.css',
          dest: 'dist/css',
          transform: (contents: string | ArrayBuffer, srcPath: string) =>
            contents.toString().replace('blue', path.basename(srcPath).replace('ss-1.css', 'oral')),
        },
      ],
    });

    expect(fs.pathExistsSync(`${fixtures}/dist/css-1.css`)).toBe(true);
    expect(await readFile(`${fixtures}/dist/css-1.css`)).toEqual(expect.stringContaining('red'));
    expect(fs.pathExistsSync(`${fixtures}/build/css-1.css`)).toBe(true);
    expect(await readFile(`${fixtures}/build/css-1.css`)).toEqual(expect.stringContaining('red'));
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-1.scss`)).toBe(true);
    expect(await readFile(`${fixtures}/dist/scss-1.scss`)).toEqual(expect.not.stringContaining('background-color'));
    expect(fs.pathExistsSync(`${fixtures}/dist/scss-2.scss`)).toBe(true);
    expect(await readFile(`${fixtures}/dist/scss-2.scss`)).toEqual(expect.not.stringContaining('background-color'));
    expect(fs.pathExistsSync(`${fixtures}/dist/nested/scss-3.scss`)).toBe(true);
    expect(await readFile(`${fixtures}/dist/nested/scss-3.scss`)).toEqual(
      expect.not.stringContaining('background-color'),
    );
    expect(fs.pathExistsSync(`${fixtures}/dist/css/css-1.css`)).toBe(true);
    expect(await readFile(`${fixtures}/dist/css/css-1.css`)).toEqual(expect.stringContaining('coral'));
  });

  describe('with verbose', () => {
    it('should log the copied files', async () => {
      console.log = jest.fn();

      await doBuild({
        targets: [
          {
            src: ['src/assets/asset-1.js', 'src/assets/css/*', 'src/assets/scss', 'src/not-exist'],
            dest: 'dist',
          },
        ],
        verbose: true,
      });

      expect(console.log).toHaveBeenCalledTimes(5);
      expect(console.log).toHaveBeenCalledWith(green('copied:'));
      expect(console.log).toHaveBeenCalledWith(
        green(`  ${bold('src/assets/asset-1.js')} → ${bold('dist/asset-1.js')}`),
      );
      expect(console.log).toHaveBeenCalledWith(
        green(`  ${bold('src/assets/css/css-1.css')} → ${bold('dist/css-1.css')}`),
      );
      expect(console.log).toHaveBeenCalledWith(
        green(`  ${bold('src/assets/css/css-2.css')} → ${bold('dist/css-2.css')}`),
      );
      expect(console.log).toHaveBeenCalledWith(green(`  ${bold('src/assets/scss')} → ${bold('dist/scss')}`));
    });

    it('should log about no files to be copied if no files need to be copied', async () => {
      console.log = jest.fn();

      await doBuild({
        targets: [{ src: 'src/not-exist', dest: 'dist' }],
        verbose: true,
      });

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(yellow('no items to copy'));
    });

    it('should log about files being renamed', async () => {
      console.log = jest.fn();

      await doBuild({
        targets: [
          {
            src: 'src/assets/asset-1.js',
            dest: 'dist',
            rename: 'asset-1-renamed.js',
          },
          {
            src: 'src/assets/scss/*',
            dest: 'dist/scss-multiple',
            rename: (name: string, extension: string) =>
              extension ? `${name}-renamed.${extension}` : `${name}-renamed`,
          },
        ],
        verbose: true,
      });

      expect(console.log).toHaveBeenCalledTimes(5);
      expect(console.log).toHaveBeenCalledWith(green('copied:'));
      expect(console.log).toHaveBeenCalledWith(
        `${green(`  ${bold('src/assets/asset-1.js')} → ${bold('dist/asset-1-renamed.js')}`)} ${yellow('[R]')}`,
      );
      expect(console.log).toHaveBeenCalledWith(
        `${green(
          `  ${bold('src/assets/scss/scss-1.scss')} → ${bold('dist/scss-multiple/scss-1-renamed.scss')}`,
        )} ${yellow('[R]')}`,
      );
      expect(console.log).toHaveBeenCalledWith(
        `${green(
          `  ${bold('src/assets/scss/scss-2.scss')} → ${bold('dist/scss-multiple/scss-2-renamed.scss')}`,
        )} ${yellow('[R]')}`,
      );
      expect(console.log).toHaveBeenCalledWith(
        `${green(`  ${bold('src/assets/scss/nested')} → ${bold('dist/scss-multiple/nested-renamed')}`)} ${yellow(
          '[R]',
        )}`,
      );
    });

    it('should log about files being transformed', async () => {
      console.log = jest.fn();

      await doBuild({
        targets: [
          {
            src: 'src/assets/css/css-*.css',
            dest: 'dist',
            transform: (contents: string | ArrayBuffer) => contents.toString().replace('background-color', 'color'),
          },
        ],
        verbose: true,
      });

      expect(console.log).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledWith(green('copied:'));
      expect(console.log).toHaveBeenCalledWith(
        `${green(`  ${bold('src/assets/css/css-1.css')} → ${bold('dist/css-1.css')}`)} ${yellow('[T]')}`,
      );
      expect(console.log).toHaveBeenCalledWith(
        `${green(`  ${bold('src/assets/css/css-2.css')} → ${bold('dist/css-2.css')}`)} ${yellow('[T]')}`,
      );
    });
  });

  describe('without flatten', () => {
    it('should not remove the directory structure of copied files', async () => {
      await doBuild({
        targets: [
          {
            src: ['src/assets/asset-1.js', 'src/assets/asset-2.js'],
            dest: 'dist',
          },
          {
            src: 'src/**/*.css',
            dest: 'dist',
          },
          {
            src: '**/*.scss',
            dest: 'dist',
            rename: (name: string, extension: string) => `${name}-renamed.${extension}`,
          },
        ],
        flatten: false,
      });

      expect(fs.pathExistsSync(`${fixtures}/dist/assets/asset-1.js`)).toBe(true);
      expect(fs.pathExistsSync(`${fixtures}/dist/assets/asset-2.js`)).toBe(true);
      expect(fs.pathExistsSync(`${fixtures}/dist/assets/css/css-1.css`)).toBe(true);
      expect(fs.pathExistsSync(`${fixtures}/dist/assets/css/css-2.css`)).toBe(true);
      expect(fs.pathExistsSync(`${fixtures}/dist/assets/scss/scss-1-renamed.scss`)).toBe(true);
      expect(fs.pathExistsSync(`${fixtures}/dist/assets/scss/scss-2-renamed.scss`)).toBe(true);
      expect(fs.pathExistsSync(`${fixtures}/dist/assets/scss/nested/scss-3-renamed.scss`)).toBe(true);
    });
  });

  describe('with globby options', () => {
    it('should handle globby options', async () => {
      await doBuild({
        targets: [{ src: 'src/assets/asset-1.js', dest: 'dist' }],
        globbyOptions: {
          ignore: ['**/asset-1.js'],
        },
      });

      expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(false);
    });

    it('should handle globby options per target', async () => {
      await doBuild({
        targets: [
          {
            src: 'src/assets/asset-1.js',
            dest: 'dist',
            globbyOptions: {
              ignore: ['**/asset-1.js'],
            },
          },
        ],
      });

      expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(false);
    });
  });

  describe('in watch mode', () => {
    it('should watch files', async () => {
      const transform = (source: string | ArrayBuffer): string => 'Author: guanghechen\n' + source.toString();

      const result = await doBuild(
        {
          targets: [{ src: 'src/assets/asset-1.js', dest: 'dist', transform }],
        },
        { watch: true },
      );

      await sleep(1000);
      expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(true);

      const originalContent = fs.readFileSync(`${fixtures}/src/assets/asset-1.js`, encoding);
      expect(fs.readFileSync(`${fixtures}/dist/asset-1.js`, encoding)).toEqual(transform(originalContent));

      const newContent = originalContent + `\nexport const message = "waw";`;
      fs.writeFileSync(`${fixtures}/src/assets/asset-1.js`, newContent, encoding);
      await sleep(1000);
      expect(fs.readFileSync(`${fixtures}/dist/asset-1.js`, encoding)).toEqual(transform(newContent));

      // Recover src/assets/asset-1.js
      fs.writeFileSync(`${fixtures}/src/assets/asset-1.js`, originalContent, encoding);
      await sleep(3000);
      expect(fs.readFileSync(`${fixtures}/dist/asset-1.js`, encoding)).toEqual(transform(originalContent));

      await fs.remove(`${fixtures}/dist`);
      expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(false);

      await replace({
        files: `${fixtures}/src/index.js`,
        from: 'hey',
        to: 'ho',
      });

      await sleep(1000);

      expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(false);

      result.stop?.();

      await replace({
        files: `${fixtures}/src/index.js`,
        from: 'ho',
        to: 'hey',
      });
    }, 10000_000);

    describe('with copyOnce', () => {
      it("shouldn't actually watch files", async () => {
        const result = await doBuild(
          {
            targets: [{ src: 'src/assets/asset-1.js', dest: 'dist' }],
            copyOnce: true,
          },
          { watch: true },
        );

        await sleep(1000);

        const originalContent = fs.readFileSync(`${fixtures}/src/assets/asset-1.js`, encoding);
        expect(fs.readFileSync(`${fixtures}/dist/asset-1.js`, encoding)).toEqual(originalContent);

        const newContent = `export const message = "waw"`;
        fs.writeFileSync(`${fixtures}/src/assets/asset-1.js`, newContent, encoding);
        await sleep(1000);
        expect(fs.readFileSync(`${fixtures}/dist/asset-1.js`, encoding)).toEqual(originalContent);

        // Recover src/assets/asset-1.js
        await sleep(1000);
        fs.writeFileSync(`${fixtures}/src/assets/asset-1.js`, originalContent, encoding);

        expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(true);

        await fs.remove(`${fixtures}/dist`);

        expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(false);

        await replace({
          files: `${fixtures}/src/index.js`,
          from: 'hey',
          to: 'ho',
        });

        await sleep(1000);

        expect(fs.pathExistsSync(`${fixtures}/dist/asset-1.js`)).toBe(false);

        result.stop?.();

        await replace({
          files: `${fixtures}/src/index.js`,
          from: 'ho',
          to: 'hey',
        });
      });
    });
  });
});
