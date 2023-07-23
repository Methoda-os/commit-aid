import { execSync } from 'child_process'

export function getDiff (contextLines = 5) {
  const diff = execSync(
    `git diff --staged --raw -U${contextLines} -- ":!package-lock.json"`
  ).toString()
  if (!diff) {
    throw new Error('No Staged files')
  }
  return diff
}
