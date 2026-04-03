import fs from 'fs'
import path from 'path'
import os from 'os'

const PLUGIN_NAME = 'faber'
const MARKETPLACE_PATH = path.join(
  os.homedir(),
  '.claude',
  'plugins',
  'marketplaces',
  'fractary-faber',
)

export const FractaryFaberPlugin = async ({ directory }) => {
  const pluginRoot = findPluginRoot(directory)

  return {
    config: async (config) => {
      const skillsDir = path.join(pluginRoot, 'plugins', PLUGIN_NAME, 'skills')
      if (fs.existsSync(skillsDir)) {
        config.instructions = config.instructions || []
        if (Array.isArray(config.instructions)) {
          config.instructions.push(skillsDir)
        }
      }
    },

    'experimental.chat.system.transform': async (_input, output) => {
      output.system.push([
        'You have access to the `fractary-faber` CLI for FABER workflow management.',
        'Skills are loaded from `plugins/faber/skills/`.',
        'Configuration is at `.fractary/config.yaml`.',
        '',
        'Key CLI commands:',
        '- `fractary-faber workflow-plan --work-id <ids>` — plan workflows',
        '- `fractary-faber workflow-run --work-id <ids>` — execute workflows',
        '- `fractary-faber config init|update|validate` — manage configuration',
        '- `fractary-faber runs verify-complete <run-id>` — verify run completion',
        '- `fractary-faber run-inspect <id>` — inspect workflow status',
      ].join('\n'))
    },
  }
}

function findMonorepoRoot(dir) {
  let current = dir
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'plugins', PLUGIN_NAME, '.claude-plugin'))) {
      return current
    }
    current = path.dirname(current)
  }
  return null
}

function findPluginRoot(directory) {
  const monorepo = findMonorepoRoot(directory)
  if (monorepo) return monorepo

  if (fs.existsSync(path.join(MARKETPLACE_PATH, 'plugins', PLUGIN_NAME))) {
    return MARKETPLACE_PATH
  }

  return directory
}
