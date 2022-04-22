import chalk from 'chalk';
import type { Plugin } from 'esbuild';
import path from 'path';
import type { ICopyTargetItem, IOptions } from './types';
import { collectAndWatchingTargets, copySingleItem, CopyWatcher, logger, normalizeOptions } from './util';

export function copy(options: IOptions = {}): Plugin {
  const config = normalizeOptions(options);
  const { targets, copyOnce } = config;
  logger.shouldBeVerbose = config.verbose;

  const plugin: Plugin = {
    name: 'copy',
    setup: (build) => {
      const { absWorkingDir = path.resolve(), watch } = build.initialOptions;

      let copied = false;
      let copyTargets: ReadonlyArray<ICopyTargetItem> | undefined;
      let watcher: CopyWatcher | undefined;

      async function fullCopy(): Promise<void> {
        if (copyTargets === undefined) copyTargets = await collectAndWatchingTargets(absWorkingDir, targets);
        if (copyTargets.length) {
          logger.verbose(chalk.green('copied:'));
          for (const copyTarget of copyTargets) await copySingleItem(absWorkingDir, copyTarget);
        } else {
          logger.verbose(chalk.yellow('no items to copy'));
        }
        copied = true;
      }

      /**
       * If a fullCopy has already been performed and the watcher has been created, there is no need for another
       * fullCopy.
       */
      async function handleCopy(): Promise<void> {
        if (copied && (copyOnce || watcher !== undefined)) return;
        await fullCopy();
      }

      build.onEnd(async () => {
        await handleCopy();
        if (!build.initialOptions.watch) {
          await watcher?.close();
        }
      });

      if (watch) {
        build.onStart(async () => {
          if (!copyOnce) {
            if (watcher === undefined) {
              watcher = new CopyWatcher(absWorkingDir);
              await fullCopy();
            }
            watcher?.watchTargets(targets);
          }
        });
      }
    },
  };

  return plugin;
}
