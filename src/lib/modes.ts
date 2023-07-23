export type CommitConfig = {
  type: CommitType
  forceBody?: boolean
}

export type CommitType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'test'
  | 'chore'

export type PromptGenerator = (config: CommitConfig) => string
