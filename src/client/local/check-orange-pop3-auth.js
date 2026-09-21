const fs = require('node:fs/promises');
const path = require('node:path');
const tls = require('node:tls');

const ENV_FILE_PATH = path.resolve(
  __dirname,
  '../functions/.env.local',
);

async function main() {
  const config = await readPop3Config(ENV_FILE_PATH);

  if (config.tls !== true) {
    throw new Error('This script expects POP3S with TLS enabled.');
  }

  const socket = await connectTlsSocket(config);
  const lineReader = createLineReader(socket);

  try {
    const greeting = await lineReader.readLine();
    assertPositiveResponse(greeting, 'POP3 greeting');

    const userResponse = await sendCommand(lineReader, socket, `USER ${config.username}`);
    assertPositiveResponse(userResponse, 'POP3 USER');

    const passwordResponse = await sendCommand(
      lineReader,
      socket,
      `PASS ${config.password}`,
    );

    if (!isPositiveResponse(passwordResponse)) {
      await quitQuietly(lineReader, socket);
      console.log('Authentication failed');
      process.exitCode = 1;
      return;
    }

    await quitQuietly(lineReader, socket);
    console.log('Authentication Success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown POP3 error.';

    if (isAuthenticationFailure(message)) {
      await destroyQuietly(socket);
      console.log('Authentication failed');
      process.exitCode = 1;
      return;
    }

    await destroyQuietly(socket);
    console.error(message);
    process.exitCode = 1;
  }
}

async function readPop3Config(envFilePath) {
  const content = await fs.readFile(envFilePath, 'utf8');
  const env = parseEnvFile(content);

  return {
    host: requireValue(env, 'POP3_HOST'),
    password: requireValue(env, 'POP3_PASSWORD'),
    port: Number.parseInt(requireValue(env, 'POP3_PORT'), 10),
    timeoutMs: Number.parseInt(requireValue(env, 'POP3_TIMEOUT_MS'), 10),
    tls: requireValue(env, 'POP3_TLS').toLowerCase() === 'true',
    username: requireValue(env, 'POP3_USERNAME'),
  };
}

function parseEnvFile(content) {
  const entries = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    entries[key] = value;
  }

  return entries;
}

function requireValue(env, key) {
  const value = env[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required value: ${key}`);
  }

  return value;
}

function connectTlsSocket(config) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: config.host,
      minVersion: 'TLSv1.2',
      port: config.port,
      rejectUnauthorized: true,
      servername: config.host,
      timeout: config.timeoutMs,
    });

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onSecureConnect = () => {
      cleanup();
      resolve(socket);
    };

    const onTimeout = () => {
      cleanup();
      socket.destroy(new Error('POP3 connection timed out.'));
      reject(new Error('POP3 connection timed out.'));
    };

    const cleanup = () => {
      socket.off('error', onError);
      socket.off('secureConnect', onSecureConnect);
      socket.off('timeout', onTimeout);
    };

    socket.setEncoding('utf8');
    socket.on('error', onError);
    socket.on('secureConnect', onSecureConnect);
    socket.on('timeout', onTimeout);
  });
}

function createLineReader(socket) {
  let buffer = '';
  let ended = false;
  const pendingReads = [];

  socket.on('data', (chunk) => {
    buffer += chunk;
    flush();
  });

  socket.on('end', () => {
    ended = true;
    flush();
  });

  socket.on('close', () => {
    ended = true;
    flush();
  });

  socket.on('error', (error) => {
    while (pendingReads.length > 0) {
      const pendingRead = pendingReads.shift();
      pendingRead.reject(error);
    }
  });

  function flush() {
    while (pendingReads.length > 0) {
      const lineBreakIndex = buffer.indexOf('\r\n');

      if (lineBreakIndex >= 0) {
        const line = buffer.slice(0, lineBreakIndex);
        buffer = buffer.slice(lineBreakIndex + 2);
        pendingReads.shift().resolve(line);
        continue;
      }

      if (ended) {
        if (buffer.length > 0) {
          const line = buffer;
          buffer = '';
          pendingReads.shift().resolve(line);
          continue;
        }

        pendingReads.shift().reject(new Error('POP3 server closed the connection.'));
      }

      break;
    }
  }

  return {
    readLine() {
      return new Promise((resolve, reject) => {
        pendingReads.push({ reject, resolve });
        flush();
      });
    },
  };
}

async function sendCommand(lineReader, socket, command) {
  socket.write(`${command}\r\n`);
  return lineReader.readLine();
}

function isPositiveResponse(responseLine) {
  return responseLine.startsWith('+OK');
}

function assertPositiveResponse(responseLine, operationName) {
  if (!isPositiveResponse(responseLine)) {
    throw new Error(`${operationName} failed: ${responseLine}`);
  }
}

function isAuthenticationFailure(message) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('authentication') ||
    normalized.includes('invalid password') ||
    normalized.includes('login') ||
    normalized.includes('pass failed') ||
    normalized.includes('user failed')
  );
}

async function quitQuietly(lineReader, socket) {
  if (socket.destroyed) {
    return;
  }

  try {
    socket.write('QUIT\r\n');
    await lineReader.readLine();
  } catch {
    // Ignore QUIT failures so the script keeps a single clear outcome.
  } finally {
    socket.end();
  }
}

async function destroyQuietly(socket) {
  if (!socket.destroyed) {
    socket.destroy();
  }
}

void main();
