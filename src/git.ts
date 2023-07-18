import { execSync } from 'child_process'

export function getDiff (ctxLines: number = 0) {
  const diff = execSync(
    `git diff --staged --raw -U${ctxLines} -- ":!package-lock.json"`
  ).toString()
  if (!diff) {
    throw new Error('No Staged files')
  }
  return diff
}
