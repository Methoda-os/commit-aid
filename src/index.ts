#!/usr/bin/env node
import { getDiff } from './git'
import { Configuration, OpenAIApi } from 'openai'
import dotenv from 'dotenv'
import path from 'path'
import os from 'os'

dotenv.config({
  path: path.join(os.homedir(), '.commit-aid.env')
})

type CommitType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'test'
  | 'chore'

type CommitConfig = {
  type: CommitType
  forceBody?: boolean
}

const createSystemMessage = (config: CommitConfig) => `
You are commit-assistant. You create commit messages from diffs.
You will be provided with a diff, and you will need to create a commit message.
the commit is of type: ${config.type}
The diff will be provided in the first prompt. you will reply "ready".
On the second user prompt, you will be asked to check the context of the diff.
Then, you will be asked to create a commit, by calling the function "commit".
`
const createContextVerification = (config: CommitConfig) => `
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

const createCommitPrompt = (config: CommitConfig) => `
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

async function main (config: CommitConfig) {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
  })
  const openai = new OpenAIApi(configuration)
  let diff = ''
  try {
    diff = getDiff()
  } catch (e: any) {
    if (e.message === 'No Staged files') {
      console.error('No Staged files. Please stage files and try again.')
      return
    }
  }

  const contextValidation = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo-16k-0613',
    messages: [
      { role: 'system', content: createSystemMessage(config) },
      { role: 'user', content: diff },
      { role: 'system', content: 'ready' },
      { role: 'user', content: createContextVerification(config) }
    ]
  })

  const contextValidationResponse =
    contextValidation.data.choices[0].message?.content
  if (!contextValidationResponse) {
    console.error('context validation failed')
    return
  }

  if (process.argv.includes('--debug'))
    console.debug('context validation: ', contextValidationResponse)

  const completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo-16k-0613',
    temperature: 0.1,
    messages: [
      { role: 'system', content: createSystemMessage(config) },
      { role: 'user', content: diff },
      { role: 'system', content: 'ready' },
      { role: 'user', content: createContextVerification(config) },
      { role: 'system', content: contextValidationResponse },
      { role: 'user', content: createCommitPrompt(config) }
    ],
    functions: [
      {
        name: 'commit',
        description: 'create a commit',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'type of commit'
            },
            scope: {
              type: 'string',
              description: 'scope of commit'
            },
            subject: {
              type: 'string',
              description: 'subject of commit'
            },
            body: {
              type: 'string',
              description: 'body of commit'
            }
          },
          required: [
            'type',
            'subject',
            config.forceBody ? 'body' : undefined
          ].filter(it => !!it)
        }
      }
    ]
  })
  if (process.argv.includes('--debug'))
    console.debug('completion: ', completion.data.choices[0].message)
  const commit = JSON.parse(
    completion.data.choices[0].message?.function_call?.arguments!
  )

  process.stdout.write(
    `
${commit.type}(${commit.scope}): ${commit.subject}

${commit.body ?? ''}
`
  )
}

main({
  type: process.argv[2] as CommitType,
  forceBody: process.argv.includes('--force-body')
})
