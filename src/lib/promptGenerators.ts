import { CommitConfig, PromptGenerator } from './modes'

export const createSystemMessage: PromptGenerator = (config: CommitConfig) => `
You are commit-assistant. You create commit messages from diffs.
You will be provided with a diff, and you will need to create a commit message.
the commit is of type: ${config.type}
The diff will be provided in the first prompt. you will reply "ready".
On the second user prompt, you will be asked to check the context of the diff.
Then, you will be asked to create a commit, by calling the function "commit".
`

export const createContextVerification: PromptGenerator = (
  config: CommitConfig
) => `
The first step would be to the context of each change.
Review the diff. Ensure that for each change in code, the related function or class definition is included.
Ignore style changes and whitespace changes.
Ignore semantically unimportant changes.
For each change, try to answer the following questions:
- Is the change in code, configuration, or documentation?
- If it's in the code, Is the change in a function or class?
- What is the signature of the function or class?
- What is the purpose of this change?
- What is the scope of this change?
- What is the impact of this change?
- What is the motivation for this change?
Then answer the following questions, about the whole diff:
- Is this a single change, or multiple changes?
- Can it be summarized in a single line message, Or is message body needed?
`

export const createCommitPrompt: PromptGenerator = (config: CommitConfig) => `
The second step would be to create a commit message.
Commit message template:
<type>(<scope>): <subject>
<BLANK LINE>
<body>

Where:
type: ${config.type}
scope: can be empty (eg. if the change is a global or difficult to assign to a single component)
subject: start with verb (such as 'change'), 50-character line
body: ${
  config.forceBody
    ? 'required.'
    : 'optional. Add body if you answered that body is needed in previous prompt.'
}, 72-character wrapped. use '-' for bullet points
Call the "commit" function with the "type", "scope", "subject" and "body" parameters.
`
