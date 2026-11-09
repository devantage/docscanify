import { CliOptions } from './cli-options.class';

describe('CliOptions', (): void => {
  it('defaults to stdio, with the http transport on 127.0.0.1:3000/mcp', (): void => {
    const options: CliOptions = CliOptions.parse([], {});

    expect(options.transport).toBe('stdio');
    expect(options.http).toEqual({
      host: '127.0.0.1',
      port: 3000,
      path: '/mcp',
    });
    expect(options.help).toBe(false);
    expect(options.version).toBe(false);
  });

  it('parses the http transport and where it listens', (): void => {
    const options: CliOptions = CliOptions.parse(
      [
        '--transport',
        'http',
        '--host',
        '0.0.0.0',
        '--port',
        '8080',
        '--path=/scanner',
      ],
      {},
    );

    expect(options.transport).toBe('http');
    expect(options.http).toEqual({
      host: '0.0.0.0',
      port: 8080,
      path: '/scanner',
    });
  });

  it.each([
    [['--help'], 'help'],
    [['-h'], 'help'],
    [['--version'], 'version'],
    [['-v'], 'version'],
  ] as const)(
    'parses %j as %s',
    (args: readonly string[], flag: 'help' | 'version'): void => {
      expect(CliOptions.parse([...args], {})[flag]).toBe(true);
    },
  );

  it.each([
    [['--transport', 'sse'], 'Invalid --transport "sse": use stdio or http'],
    [['--port', 'abc'], 'Invalid --port "abc"'],
    [['--port', '70000'], 'Invalid --port "70000"'],
    [['--port=-1'], 'Invalid --port "-1"'],
    [['--path', 'mcp'], 'Invalid --path "mcp"'],
    [['--path', '/health'], 'Invalid --path "/health"'],
    [['--host', ' '], 'Invalid --host'],
    [['--unknown'], "Unknown option '--unknown'"],
    [['extra'], 'extra'],
  ])('rejects %j', (args: string[], message: string): void => {
    expect((): CliOptions => CliOptions.parse(args, {})).toThrow(message);
  });

  it('reads the options not given from the environment', (): void => {
    const options: CliOptions = CliOptions.parse([], {
      DOCSCANIFY_MCP_TRANSPORT: 'http',
      DOCSCANIFY_MCP_HOST: '0.0.0.0',
      DOCSCANIFY_MCP_PORT: '8080',
      DOCSCANIFY_MCP_PATH: '/scanner',
    });

    expect(options.transport).toBe('http');
    expect(options.http).toEqual({
      host: '0.0.0.0',
      port: 8080,
      path: '/scanner',
    });
  });

  it('prefers the command line to the environment', (): void => {
    const options: CliOptions = CliOptions.parse(['--port', '9090'], {
      DOCSCANIFY_MCP_TRANSPORT: 'http',
      DOCSCANIFY_MCP_PORT: '8080',
    });

    expect(options.transport).toBe('http');
    expect(options.http.port).toBe(9090);
  });

  it('ignores empty environment variables', (): void => {
    const options: CliOptions = CliOptions.parse([], {
      DOCSCANIFY_MCP_TRANSPORT: '',
      DOCSCANIFY_MCP_PORT: '',
    });

    expect(options.transport).toBe('stdio');
    expect(options.http.port).toBe(3000);
  });

  it.each([
    [
      { DOCSCANIFY_MCP_TRANSPORT: 'sse' },
      'Invalid DOCSCANIFY_MCP_TRANSPORT "sse": use stdio or http',
    ],
    [{ DOCSCANIFY_MCP_PORT: 'abc' }, 'Invalid DOCSCANIFY_MCP_PORT "abc"'],
    [{ DOCSCANIFY_MCP_PATH: 'mcp' }, 'Invalid DOCSCANIFY_MCP_PATH "mcp"'],
    [{ DOCSCANIFY_MCP_HOST: ' ' }, 'Invalid DOCSCANIFY_MCP_HOST'],
  ])(
    'rejects the environment %j, naming the variable',
    (env: NodeJS.ProcessEnv, message: string): void => {
      expect((): CliOptions => CliOptions.parse([], env)).toThrow(message);
    },
  );

  it('lists the environment variables in the usage', (): void => {
    for (const variable of Object.values(CliOptions.ENVIRONMENT_VARIABLES)) {
      expect(CliOptions.USAGE).toContain(variable);
    }
  });
});
