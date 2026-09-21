const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

class EmulatorJavaHelper {
  static getRepositoryRoot() {
    return dirname(__dirname);
  }

  static getJavaMajorVersion(javaExecutable) {
    const result = spawnSync(javaExecutable, ['-version'], {
      encoding: 'utf8',
    });
    const versionOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    const match = versionOutput.match(/"(?<major>\d+)/u);

    if (match?.groups?.major === undefined) {
      throw new Error(`Unable to determine Java version from ${javaExecutable}.`);
    }

    return Number.parseInt(match.groups.major, 10);
  }

  static findJavaHome() {
    const javaCandidates = [];

    if (typeof process.env.JAVA_HOME === 'string' && process.env.JAVA_HOME.length > 0) {
      javaCandidates.push(join(process.env.JAVA_HOME, 'bin', this.getJavaExecutableName()));
    }

    for (const basePath of this.getJavaBasePaths()) {
      if (!existsSync(basePath)) {
        continue;
      }

      const entries = require('node:fs')
        .readdirSync(basePath, {
          withFileTypes: true,
        })
        .filter((entry) => entry.isDirectory() && /^(jdk|jre|openjdk).*21/iu.test(entry.name))
        .sort((left, right) => right.name.localeCompare(left.name));

      for (const entry of entries) {
        javaCandidates.push(
          join(basePath, entry.name, 'bin', this.getJavaExecutableName()),
        );
      }
    }

    const pathJava = this.resolveJavaFromPath();

    if (pathJava !== null) {
      javaCandidates.push(pathJava);
    }

    for (const javaExecutable of [...new Set(javaCandidates)]) {
      if (!existsSync(javaExecutable)) {
        continue;
      }

      if (this.getJavaMajorVersion(javaExecutable) >= 21) {
        return dirname(dirname(javaExecutable));
      }
    }

    throw new Error(
      'Java 21 was not found. Install a JDK 21 and ensure it exists in JAVA_HOME or under C:\\Program Files\\Java.',
    );
  }

  static getJavaBasePaths() {
    return process.platform === 'win32'
      ? ['C:\\Program Files\\Java', 'C:\\Program Files\\Eclipse Adoptium']
      : ['/usr/lib/jvm', '/Library/Java/JavaVirtualMachines'];
  }

  static getJavaExecutableName() {
    return process.platform === 'win32' ? 'java.exe' : 'java';
  }

  static resolveJavaFromPath() {
    const command = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(command, ['java'], {
      encoding: 'utf8',
    });

    if (result.status !== 0) {
      return null;
    }

    const [firstMatch] = result.stdout
      .split(/\r?\n/u)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    return firstMatch ?? null;
  }
}

class EmulatorProjectHelper {
  static getProjectId(repositoryRoot) {
    if (
      typeof process.env.APP_FIREBASE_PROJECT_ID === 'string' &&
      process.env.APP_FIREBASE_PROJECT_ID.length > 0
    ) {
      return process.env.APP_FIREBASE_PROJECT_ID;
    }

    const environmentFilePath = join(repositoryRoot, 'functions', '.env.local');

    if (!existsSync(environmentFilePath)) {
      throw new Error(
        'Unable to resolve APP_FIREBASE_PROJECT_ID. Define it in functions/.env.local.',
      );
    }

    const projectIdLine = readFileSync(environmentFilePath, 'utf8')
      .split(/\r?\n/u)
      .find((line) => /^APP_FIREBASE_PROJECT_ID=/u.test(line));

    if (projectIdLine === undefined) {
      throw new Error('APP_FIREBASE_PROJECT_ID is missing from functions/.env.local.');
    }

    return projectIdLine.replace(/^APP_FIREBASE_PROJECT_ID=/u, '').trim();
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    childProcess.on('error', reject);
    childProcess.on('exit', (code) => {
      resolve(code ?? 1);
    });
  });
}

function createProcessEnvironment(javaHome, projectId) {
  const environment = {};
  let pathKey = 'PATH';

  for (const [key, value] of Object.entries(process.env)) {
    if (/^path$/iu.test(key)) {
      pathKey = key;
      continue;
    }

    environment[key] = value;
  }

  const currentPath = process.env[pathKey] ?? process.env.PATH ?? process.env.Path ?? '';

  environment.GCLOUD_PROJECT = projectId;
  environment.JAVA_HOME = javaHome;
  environment[pathKey] = `${join(javaHome, 'bin')};${currentPath}`;

  return environment;
}

async function main() {
  const repositoryRoot = EmulatorJavaHelper.getRepositoryRoot();
  const javaHome = EmulatorJavaHelper.findJavaHome();
  const projectId = EmulatorProjectHelper.getProjectId(repositoryRoot);
  const env = createProcessEnvironment(javaHome, projectId);
  const localMode = process.argv.includes('--local');

  console.log(`Using JAVA_HOME=${javaHome}`);
  console.log(`Using Firebase project ${projectId}`);
  console.log('Building Firebase Functions...');

  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const firebaseExecutable = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';

  const buildExitCode = await runCommand(
    npmExecutable,
    ['run', 'build', '--workspace', 'functions'],
    {
      cwd: repositoryRoot,
      env,
    },
  );

  if (buildExitCode !== 0) {
    process.exit(buildExitCode);
  }

  if (localMode) {
    console.log('Building Angular web app for Firebase Hosting...');

    const webBuildExitCode = await runCommand(
      npmExecutable,
      ['run', 'build', '--workspace', 'web'],
      {
        cwd: repositoryRoot,
        env,
      },
    );

    if (webBuildExitCode !== 0) {
      process.exit(webBuildExitCode);
    }

    createLocalHostingConfig(repositoryRoot);
    console.log('Starting Firebase emulators: hosting, auth, firestore, functions, pubsub');
  } else {
    console.log('Starting Firebase emulators: firestore, functions, pubsub');
  }

  const emulatorExitCode = await runCommand(
    firebaseExecutable,
    [
      'emulators:start',
      '--project',
      projectId,
      '--only',
      localMode ? 'hosting,auth,functions,firestore,pubsub' : 'functions,firestore,pubsub',
    ],
    {
      cwd: repositoryRoot,
      env,
    },
  );

  process.exit(emulatorExitCode);
}

function createLocalHostingConfig(repositoryRoot) {
  const hostingConfigPath = join(
    repositoryRoot,
    'web',
    'dist',
    'web',
    'browser',
    'app-config.json',
  );

  mkdirSync(dirname(hostingConfigPath), {
    recursive: true,
  });

  writeFileSync(
    hostingConfigPath,
    JSON.stringify(
      {
        appName: 'POP3 Remailer',
        apiBaseUrl: '',
        authEmulatorUrl: 'http://127.0.0.1:9099',
        firebaseConfig: createLocalFirebaseWebConfig(
          EmulatorProjectHelper.getProjectId(repositoryRoot),
        ),
      },
      null,
      2,
    ),
  );
}

function createLocalFirebaseWebConfig(projectId) {
  return {
    apiKey: `${projectId}-local-api-key`,
    appId: `1:000000000000:web:${projectId.replace(/[^a-z0-9]/giu, '')}`,
    authDomain: `${projectId}.firebaseapp.com`,
    messagingSenderId: '000000000000',
    projectId,
  };
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
