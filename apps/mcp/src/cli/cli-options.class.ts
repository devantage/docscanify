import { parseArgs } from 'node:util';

/** How the server talks to its clients. */
export type TransportName = 'stdio' | 'http';

/** Where the streamable HTTP transport listens. */
export interface HttpListenOptions {
  host: string;

  port: number;

  /** Path of the MCP endpoint, starting with a slash */
  path: string;
}

/** The options that take a value, which an environment variable can also set. */
type ValueOptionName = 'transport' | 'host' | 'port' | 'path';

/** A value of an option, with where it came from, to name it in errors. */
interface OptionValue {
  value: string;

  /** The option, such as `--port`, or the environment variable */
  source: string;
}

const TRANSPORT_NAMES: readonly TransportName[] = ['stdio', 'http'];

const MAX_PORT: number = 65535;

const DEFAULT_VALUES: Readonly<Record<ValueOptionName, string>> = {
  transport: 'stdio',
  host: '127.0.0.1',
  port: '3000',
  path: '/mcp',
};

/** The options of the command line, parsed and validated. */
export class CliOptions {
  /** The environment variable of each option, used when the option is not given. */
  public static readonly ENVIRONMENT_VARIABLES: Readonly<
    Record<ValueOptionName, string>
  > = {
    transport: 'DOCSCANIFY_MCP_TRANSPORT',
    host: 'DOCSCANIFY_MCP_HOST',
    port: 'DOCSCANIFY_MCP_PORT',
    path: 'DOCSCANIFY_MCP_PATH',
  };

  public static readonly USAGE: string = [
    'Usage: docscanify-mcp [options]',
    '',
    'Options:',
    '  --transport <stdio|http>  How clients connect (default: stdio)',
    '  --host <host>             Host the http transport listens on (default: 127.0.0.1)',
    '  --port <port>             Port the http transport listens on (default: 3000)',
    '  --path <path>             Path of the MCP endpoint of the http transport (default: /mcp)',
    '  -h, --help                Shows this help',
    '  -v, --version             Shows the version',
    '',
    'Environment variables, used for the options not given:',
    ...Object.entries(CliOptions.ENVIRONMENT_VARIABLES).map(
      ([option, variable]: [string, string]): string =>
        `  ${variable.padEnd(26)}Same as --${option}`,
    ),
  ].join('\n');

  private constructor(
    public readonly transport: TransportName,
    public readonly http: HttpListenOptions,
    public readonly help: boolean,
    public readonly version: boolean,
  ) {}

  /**
   * Each option comes from the command line, then from its environment
   * variable (empty ones are ignored), then from its default.
   *
   * @param args the arguments of the command, without the node executable and
   * the script
   * @param env the environment variables, usually `process.env`
   * @throws with a message for the user if an argument or environment
   * variable is unknown or invalid
   */
  public static parse(args: string[], env: NodeJS.ProcessEnv): CliOptions {
    const { values } = parseArgs({
      args,
      strict: true,
      allowPositionals: false,
      options: {
        transport: { type: 'string' },
        host: { type: 'string' },
        port: { type: 'string' },
        path: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
    const resolveValue = (name: ValueOptionName): OptionValue =>
      CliOptions.resolveValue(name, values[name], env);

    return new CliOptions(
      CliOptions.parseTransport(resolveValue('transport')),
      {
        host: CliOptions.parseHost(resolveValue('host')),
        port: CliOptions.parsePort(resolveValue('port')),
        path: CliOptions.parsePath(resolveValue('path')),
      },
      values.help,
      values.version,
    );
  }

  private static resolveValue(
    name: ValueOptionName,
    argument: string | undefined,
    env: NodeJS.ProcessEnv,
  ): OptionValue {
    if (argument !== undefined) {
      return { value: argument, source: `--${name}` };
    }

    const variable: string = CliOptions.ENVIRONMENT_VARIABLES[name];
    const environmentValue: string | undefined = env[variable];

    if (environmentValue) {
      return { value: environmentValue, source: variable };
    }

    return { value: DEFAULT_VALUES[name], source: `--${name}` };
  }

  private static parseTransport({ value, source }: OptionValue): TransportName {
    if (!(TRANSPORT_NAMES as readonly string[]).includes(value)) {
      throw new Error(
        `Invalid ${source} "${value}": use ${TRANSPORT_NAMES.join(' or ')}`,
      );
    }

    return value as TransportName;
  }

  private static parseHost({ value, source }: OptionValue): string {
    if (!value.trim()) {
      throw new Error(`Invalid ${source}: it cannot be empty`);
    }

    return value.trim();
  }

  private static parsePort({ value, source }: OptionValue): number {
    const port: number = Number(value);

    if (!/^\d+$/.test(value) || port > MAX_PORT) {
      throw new Error(
        `Invalid ${source} "${value}": use a number from 0 to ${String(MAX_PORT)}`,
      );
    }

    return port;
  }

  private static parsePath({ value, source }: OptionValue): string {
    if (!value.startsWith('/') || value === '/health') {
      throw new Error(
        `Invalid ${source} "${value}": it must start with a slash and cannot be /health`,
      );
    }

    return value;
  }
}
