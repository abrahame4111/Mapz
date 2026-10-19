// Cross-platform wrapper: runs the Gradle wrapper inside ./android (gradlew.bat on Windows).
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const win = process.platform === 'win32';
const wrapper = resolve('android', win ? 'gradlew.bat' : 'gradlew');
// Absolute path so Windows does not depend on cwd lookup rules for executables.
const r = spawnSync(wrapper, process.argv.slice(2), { cwd: 'android', stdio: 'inherit', shell: win });
process.exit(r.status ?? 1);
