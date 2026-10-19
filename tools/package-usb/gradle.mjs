// Cross-platform wrapper: runs the Gradle wrapper inside ./android (gradlew.bat on Windows).
// Passes the build number (build-number.txt) so versionCode/versionName match the APK file name.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const win = process.platform === 'win32';
const build = readFileSync('build-number.txt', 'utf8').trim();
const wrapper = resolve('android', win ? 'gradlew.bat' : 'gradlew');
// Absolute path so Windows does not depend on cwd lookup rules for executables.
const r = spawnSync(wrapper, ['-PbuildNumber=' + build, ...process.argv.slice(2)], { cwd: 'android', stdio: 'inherit', shell: win });
process.exit(r.status ?? 1);
