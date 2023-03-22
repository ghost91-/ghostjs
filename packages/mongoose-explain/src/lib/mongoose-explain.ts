import { Document, ExplainVerbosity } from 'mongodb';
import type { Schema, PostMiddlewareFunction, Query } from 'mongoose';

export type Verbosity = (typeof ExplainVerbosity)[keyof typeof ExplainVerbosity];

export type Operation = 'find' | 'findOne';

/** Additional options to configure plugin returned by {@link explain}. */
export interface ExplainOptions {
  /**
   * The verbosity level of the explanation
   *
   * @defaultValue
   * ```typescript
   * ExplainVerbosity.queryPlanner
   * ```
   */
  verbosity?: Verbosity | undefined;

  /** The callback to invoke with the explanation result */
  callback?: (operation: string, result: Document) => void | undefined;

  /**
   * The operations which to explain;
   *
   * @defaultValue
   * ```typescript
   * new Set(['find', 'findOne'])
   * ```
   */
  operations?: Set<Operation> | undefined;
}

/** The type of a mongoose plugin that can handle any type of schema */
export type Plugin<Opts = undefined> = <T>(schema: Schema<T>, opts?: Opts | undefined) => void;

/**
 * Creates a mongoose plugin the explains performed queries.
 *
 * @param options Additional options to configure the plugin
 * @returns A mongoose plugin that explains performed queries
 */
export function explain({
  verbosity = defaultVerbosity,
  callback = defaultCallback,
  operations = defaultOperations,
}: ExplainOptions = {}): Plugin {
  return <T>(schema: Schema<T>) => {
    operations.forEach((operation) => {
      const middleware = getMiddleware(verbosity, (result) => callback(operation, result));
      schema.post(operation, middleware);
    });
  };
}

const defaultVerbosity = ExplainVerbosity.queryPlanner;
const defaultOperations: Set<Operation> = new Set(['find', 'findOne'] as const);
const defaultCallback = (operation: string, result: Document) => {
  console.log(`mongoose query explanation for '${operation}':`);
  console.dir(result);
};

function getMiddleware(
  verbosity: Verbosity,
  callback: (result: Document) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): PostMiddlewareFunction<Query<any, any, any, any>> {
  return function (_res, next) {
    if (this.getOptions().explain) {
      return next();
    }

    const query = this.clone().explain(verbosity);
    query.exec().then((result) => {
      callback(result);
      next();
    });
  };
}
