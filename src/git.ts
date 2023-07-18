import { execSync } from 'child_process'

export function getDiff () {
  const diff = execSync(
    `git diff --staged --raw -U5 -- ":!package-lock.json"`
  ).toString()
  if (!diff) {
    throw new Error('No Staged files')
  }
  return diff
}
