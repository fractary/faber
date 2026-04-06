import fs from 'fs'
import path from 'path'
import os from 'os'

const PLUGIN_NAMES = ['faber']
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
      config.skills = config.skills || {}
      config.skills.paths = config.skills.paths || []

      for (const name of PLUGIN_NAMES) {
        const skillsDir = path.join(pluginRoot, 'plugins', name, 'skills')
        if (fs.existsSync(skillsDir)) {
          config.skills.paths.push(skillsDir)
        }
      }
    },

    'experimental.chat.system.transform': async (_input, output) => {
      output.system.push(
        [
          'You have access to FABER workflow management via skills.',
          'Skills are loaded from `plugins/faber/skills/`.',
          'Configuration is at `.fractary/config.yaml`.',
          '',
          'IMPORTANT: To plan and execute workflows, use SKILLS (not CLI commands).',
          'Invoke skills by describing the intent — the platform will route to the correct skill.',
          '',
          'Available workflow skills:',
          '- `fractary-faber-workflow-plan` — plan workflows for a work item',
          '- `fractary-faber-workflow-run` — execute a planned workflow for a work item',
          '- `fractary-faber-workflow-batch-plan` — plan multiple workflows at once',
          '- `fractary-faber-workflow-batch-run` — execute a batch of planned workflows',
          '',
          'Utility CLI commands (inspection/config only — these are OK to run via shell):',
          '- `fractary-faber config init|update|validate` — manage configuration',
          '- `fractary-faber runs verify-complete <run-id>` — verify run completion',
          '- `fractary-faber run-inspect <id>` — inspect workflow status',
        ].join('\n'),
      )
    },
  }
}

function findMonorepoRoot(dir) {
  let current = dir
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'plugins', 'faber', '.claude-plugin'))) {
      return current
    }
    current = path.dirname(current)
  }
  return null
}

function findPluginRoot(directory) {
  const monorepo = findMonorepoRoot(directory)
  if (monorepo) return monorepo

  if (fs.existsSync(path.join(MARKETPLACE_PATH, 'plugins', 'faber'))) {
    return MARKETPLACE_PATH
  }

  return directory
}
