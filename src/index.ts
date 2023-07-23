#!/usr/bin/env node
import { getDiff } from './git'
import { Configuration, OpenAIApi } from 'openai'
import dotenv from 'dotenv'
import path from 'path'
import os from 'os'
import { CommitConfig, CommitType } from './lib/modes'
import readline from 'readline'
import fs from 'fs'
import {
  createCommitPrompt,
  createContextVerification,
  createSystemMessage
} from './lib/promptGenerators'

dotenv.config({
  path: path.join(os.homedir(), '.commit-aid.env')
})

async function main (config: CommitConfig) {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set')
    process.stdout.write('set OPENAI_API_KEY:')
    const rl = readline.createInterface(process.stdin, process.stdout)
    rl.on('line', line => {
      process.env.OPENAI_API_KEY = line
      rl.close()
      fs.writeFileSync(
        path.join(os.homedir(), '.commit-aid.env'),
        `OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`
      )
    })
    return
  }

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
    model: 'gpt-4-0613',
    temperature: 0.3,
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
