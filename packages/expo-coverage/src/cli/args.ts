export interface Parsed {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
  /** Every value given for a repeatable flag, in order: `--exclude a --exclude b` → `{ exclude: ['a', 'b'] }`. */
  lists: Record<string, string[]>;
  /** Everything after `--`. */
  rest: string[];
}

/** Tiny argv parser: `--key value`, `--flag`, `--key=value`, and `--` to pass a command through. */
export function parseArgs(argv: string[]): Parsed {
  const dash = argv.indexOf('--');
  const head = dash === -1 ? argv : argv.slice(0, dash);
  const rest = dash === -1 ? [] : argv.slice(dash + 1);
  const flags: Parsed['flags'] = {};
  const lists: Parsed['lists'] = {};
  const positionals: string[] = [];
  for (let i = 0; i < head.length; i++) {
    const arg = head[i]!;
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=');
      if (inline !== undefined) flags[key!] = inline;
      else if (head[i + 1] !== undefined && !head[i + 1]!.startsWith('--')) flags[key!] = head[++i]!;
      else flags[key!] = true;
      if (typeof flags[key!] === 'string') (lists[key!] ??= []).push(flags[key!] as string);
    } else positionals.push(arg);
  }
  return { command: positionals[0], positionals: positionals.slice(1), flags, lists, rest };
}

export const str = (v: string | boolean | undefined): string | undefined => (typeof v === 'string' ? v : undefined);
