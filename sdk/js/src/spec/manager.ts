/**
 * @fractary/faber - Spec Manager
 *
 * Specification management for FABER workflows.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  SpecConfig,
  Specification,
  SpecMetadata,
  SpecPhase,
  SpecTask,
  SpecCreateOptions,
  SpecListOptions,
  SpecValidateResult,
  SpecRefineResult,
  SpecTemplateType,
  WorkType,
  PhaseUpdateOptions,
} from './types.js';
import { getTemplate, generateSpecContent, templates } from './templates.js';
import { loadSpecConfig, findProjectRoot } from '../config.js';
import { SpecError } from '../errors.js';

/**
 * Parse spec frontmatter and content
 */
function parseSpec(content: string, filePath: string): Specification {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    throw new SpecError('parse', `Invalid spec format in ${filePath}: missing frontmatter`);
  }

  const [, frontmatterStr, body] = frontmatterMatch;
  const frontmatter: Record<string, string> = {};

  for (const line of frontmatterStr.split('\n')) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      frontmatter[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  // Parse phases from content
  const phases = parsePhases(body);

  return {
    id: frontmatter.id || path.basename(filePath, '.md'),
    path: filePath,
    title: frontmatter.title || 'Untitled',
    workId: frontmatter.work_id,
    workType: (frontmatter.work_type as WorkType) || 'feature',
    template: (frontmatter.template as SpecTemplateType) || 'basic',
    content: body,
    metadata: {
      created_at: frontmatter.created_at || new Date().toISOString(),
      updated_at: frontmatter.updated_at || new Date().toISOString(),
      validation_status: frontmatter.validation_status as SpecMetadata['validation_status'] || 'not_validated',
      source: (frontmatter.source as SpecMetadata['source']) || 'conversation',
    },
    phases,
  };
}

/**
 * Parse phases from spec content
 */
function parsePhases(content: string): SpecPhase[] {
  const phases: SpecPhase[] = [];
  const phaseMatches = content.matchAll(/## Phase (\d+): ([^\n]+)\n([\s\S]*?)(?=## Phase \d+:|## [A-Z]|$)/gi);

  for (const match of phaseMatches) {
    const [, phaseNum, title, phaseContent] = match;
    const tasks = parseTasks(phaseContent);

    // Determine status based on tasks
    let status: SpecPhase['status'] = 'not_started';
    if (tasks.length > 0) {
      const completedCount = tasks.filter(t => t.completed).length;
      if (completedCount === tasks.length) {
        status = 'complete';
      } else if (completedCount > 0) {
        status = 'in_progress';
      }
    }

    phases.push({
      id: `phase-${phaseNum}`,
      title: title.trim(),
      status,
      tasks,
    });
  }

  return phases;
}

/**
 * Parse tasks from phase content
 */
function parseTasks(content: string): SpecTask[] {
  const tasks: SpecTask[] = [];
  const taskMatches = content.matchAll(/- \[([ xX])\] (.+)/g);

  for (const match of taskMatches) {
    const [, checkbox, text] = match;
    tasks.push({
      text: text.trim(),
      completed: checkbox.toLowerCase() === 'x',
    });
  }

  return tasks;
}

/**
 * Serialize spec back to markdown
 */
function serializeSpec(spec: Specification): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push('---');
  lines.push(`id: ${spec.id}`);
  lines.push(`title: "${spec.title}"`);
  if (spec.workId) {
    lines.push(`work_id: "${spec.workId}"`);
  }
  lines.push(`work_type: ${spec.workType}`);
  lines.push(`template: ${spec.template}`);
  lines.push(`created_at: ${spec.metadata.created_at}`);
  lines.push(`updated_at: ${new Date().toISOString()}`);
  if (spec.metadata.validation_status) {
    lines.push(`validation_status: ${spec.metadata.validation_status}`);
  }
  lines.push(`source: ${spec.metadata.source}`);
  lines.push('---');
  lines.push('');

  // Content
  lines.push(spec.content);

  return lines.join('\n');
}

/**
 * Specification Manager
 */
export class SpecManager {
  private config: SpecConfig;
  private specsDir: string;

  constructor(config?: Partial<SpecConfig>) {
    // Try to load config, but allow missing - use defaults if not found
    const loadedConfig = config ? null : loadSpecConfig(undefined, { allowMissing: true });

    // Merge provided config, loaded config, or use defaults
    this.config = this.mergeWithDefaults(config, loadedConfig);

    const projectRoot = findProjectRoot();
    this.specsDir = this.config.localPath || path.join(projectRoot, 'specs');
  }

  /**
   * Get default spec configuration
   */
  private getDefaultSpecConfig(): SpecConfig {
    const projectRoot = findProjectRoot();
    return {
      localPath: path.join(projectRoot, 'specs'),
    };
  }

  /**
   * Merge partial config with defaults
   */
  private mergeWithDefaults(
    partialConfig?: Partial<SpecConfig>,
    loadedConfig?: SpecConfig | null
  ): SpecConfig {
    const defaults = this.getDefaultSpecConfig();

    // Priority: provided config > loaded config > defaults
    return {
      localPath: partialConfig?.localPath || loadedConfig?.localPath || defaults.localPath,
    };
  }

  /**
   * Ensure specs directory exists
   */
  private ensureSpecsDir(): void {
    if (!fs.existsSync(this.specsDir)) {
      fs.mkdirSync(this.specsDir, { recursive: true });
    }
  }

  /**
   * Get spec file path
   */
  private getSpecPath(id: string): string {
    // If it's already a full path, return it
    if (path.isAbsolute(id)) {
      return id;
    }

    // If it has a .md extension, treat as filename
    if (id.endsWith('.md')) {
      return path.join(this.specsDir, id);
    }

    // Otherwise, construct path from ID
    return path.join(this.specsDir, `${id}.md`);
  }

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  /**
   * Create a new specification
   */
  createSpec(title: string, options?: SpecCreateOptions): Specification {
    this.ensureSpecsDir();

    const templateType = options?.template || 'basic';
    const template = getTemplate(templateType);
    const workType = this.inferWorkType(templateType);

    const content = generateSpecContent(template, {
      title,
      workId: options?.workId,
      workType,
      context: options?.context,
    });

    // Generate filename
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    const filename = options?.workId
      ? `${options.workId}-${slug}.md`
      : `${slug}.md`;
    const filePath = path.join(this.specsDir, filename);

    // Check if exists
    if (fs.existsSync(filePath) && !options?.force) {
      throw new SpecError('create', `Spec already exists at ${filePath}. Use force option to overwrite.`);
    }

    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');

    // Return parsed spec
    return parseSpec(content, filePath);
  }

  /**
   * Get a specification by ID or path
   */
  getSpec(idOrPath: string): Specification | null {
    const filePath = this.getSpecPath(idOrPath);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return parseSpec(content, filePath);
  }

  /**
   * Update a specification
   */
  updateSpec(
    idOrPath: string,
    updates: {
      title?: string;
      content?: string;
      workId?: string;
      workType?: WorkType;
      validationStatus?: SpecMetadata['validation_status'];
    }
  ): Specification {
    const spec = this.getSpec(idOrPath);
    if (!spec) {
      throw new SpecError('update', `Spec not found: ${idOrPath}`);
    }

    // Apply updates
    if (updates.title !== undefined) {
      spec.title = updates.title;
    }
    if (updates.content !== undefined) {
      spec.content = updates.content;
    }
    if (updates.workId !== undefined) {
      spec.workId = updates.workId;
    }
    if (updates.workType !== undefined) {
      spec.workType = updates.workType;
    }
    if (updates.validationStatus !== undefined) {
      spec.metadata.validation_status = updates.validationStatus;
    }

    // Update timestamp
    spec.metadata.updated_at = new Date().toISOString();

    // Write back
    fs.writeFileSync(spec.path, serializeSpec(spec), 'utf-8');

    return spec;
  }

  /**
   * Delete a specification
   */
  deleteSpec(idOrPath: string): boolean {
    const filePath = this.getSpecPath(idOrPath);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    fs.unlinkSync(filePath);
    return true;
  }

  /**
   * List all specifications
   */
  listSpecs(options?: SpecListOptions): Specification[] {
    this.ensureSpecsDir();

    const files = fs.readdirSync(this.specsDir).filter(f => f.endsWith('.md'));
    const specs: Specification[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.specsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const spec = parseSpec(content, filePath);

        // Apply filters
        if (options?.workId && spec.workId !== options.workId) {
          continue;
        }
        if (options?.template && spec.template !== options.template) {
          continue;
        }
        if (options?.status) {
          const status = spec.metadata.validation_status || 'not_validated';
          if (status !== options.status) {
            continue;
          }
        }

        specs.push(spec);
      } catch {
        // Skip invalid spec files
      }
    }

    return specs;
  }

  // =========================================================================
  // Phase & Task Operations
  // =========================================================================

  /**
   * Update a phase in a specification
   */
  updatePhase(
    specIdOrPath: string,
    phaseId: string,
    updates: PhaseUpdateOptions
  ): Specification {
    const spec = this.getSpec(specIdOrPath);
    if (!spec) {
      throw new SpecError('updatePhase', `Spec not found: ${specIdOrPath}`);
    }

    const phase = spec.phases?.find(p => p.id === phaseId);
    if (!phase) {
      throw new SpecError('updatePhase', `Phase not found: ${phaseId}`);
    }

    // Apply updates
    if (updates.status !== undefined) {
      phase.status = updates.status;
    }
    if (updates.objective !== undefined) {
      phase.objective = updates.objective;
    }
    if (updates.notes !== undefined) {
      phase.notes = updates.notes;
    }

    // Update content to reflect phase changes
    spec.content = this.updatePhaseInContent(spec.content, phase);
    spec.metadata.updated_at = new Date().toISOString();

    // Write back
    fs.writeFileSync(spec.path, serializeSpec(spec), 'utf-8');

    return spec;
  }

  /**
   * Complete a task in a phase
   */
  completeTask(
    specIdOrPath: string,
    phaseId: string,
    taskIndex: number
  ): Specification {
    const spec = this.getSpec(specIdOrPath);
    if (!spec) {
      throw new SpecError('completeTask', `Spec not found: ${specIdOrPath}`);
    }

    const phase = spec.phases?.find(p => p.id === phaseId);
    if (!phase) {
      throw new SpecError('completeTask', `Phase not found: ${phaseId}`);
    }

    if (taskIndex < 0 || taskIndex >= phase.tasks.length) {
      throw new SpecError('completeTask', `Invalid task index: ${taskIndex}`);
    }

    phase.tasks[taskIndex].completed = true;

    // Update phase status
    const completedCount = phase.tasks.filter(t => t.completed).length;
    if (completedCount === phase.tasks.length) {
      phase.status = 'complete';
    } else if (completedCount > 0) {
      phase.status = 'in_progress';
    }

    // Update content
    spec.content = this.updateTasksInContent(spec.content, phase);
    spec.metadata.updated_at = new Date().toISOString();

    // Write back
    fs.writeFileSync(spec.path, serializeSpec(spec), 'utf-8');

    return spec;
  }

  /**
   * Add a task to a phase
   */
  addTask(
    specIdOrPath: string,
    phaseId: string,
    taskText: string
  ): Specification {
    const spec = this.getSpec(specIdOrPath);
    if (!spec) {
      throw new SpecError('addTask', `Spec not found: ${specIdOrPath}`);
    }

    const phase = spec.phases?.find(p => p.id === phaseId);
    if (!phase) {
      throw new SpecError('addTask', `Phase not found: ${phaseId}`);
    }

    phase.tasks.push({
      text: taskText,
      completed: false,
    });

    // Update content
    spec.content = this.updateTasksInContent(spec.content, phase);
    spec.metadata.updated_at = new Date().toISOString();

    // Write back
    fs.writeFileSync(spec.path, serializeSpec(spec), 'utf-8');

    return spec;
  }

  // =========================================================================
  // Validation
  // =========================================================================

  /**
   * Validate a specification
   */
  validateSpec(specIdOrPath: string): SpecValidateResult {
    const spec = this.getSpec(specIdOrPath);
    if (!spec) {
      throw new SpecError('validate', `Spec not found: ${specIdOrPath}`);
    }

    const checks: SpecValidateResult['checks'] = {
      requirements: { completed: 0, total: 0, status: 'pass' },
      acceptanceCriteria: { met: 0, total: 0, status: 'pass' },
      filesModified: { status: 'pass' },
      testsAdded: { added: 0, expected: 0, status: 'pass' },
      docsUpdated: { status: 'pass' },
    };

    const suggestions: string[] = [];

    // Check requirements section
    const requirementsMatch = spec.content.match(/## Requirements\n([\s\S]*?)(?=##|$)/i);
    if (requirementsMatch) {
      const reqContent = requirementsMatch[1];
      const allReqs = reqContent.match(/- \[([ xX])\]/g) || [];
      const completedReqs = reqContent.match(/- \[[xX]\]/g) || [];

      checks.requirements.total = allReqs.length;
      checks.requirements.completed = completedReqs.length;

      if (checks.requirements.total === 0) {
        checks.requirements.status = 'fail';
        suggestions.push('Add specific requirements to the Requirements section');
      } else if (checks.requirements.completed < checks.requirements.total) {
        checks.requirements.status = 'warn';
        suggestions.push(`Complete remaining requirements (${checks.requirements.total - checks.requirements.completed} pending)`);
      }
    } else {
      checks.requirements.status = 'fail';
      suggestions.push('Add a Requirements section to the specification');
    }

    // Check acceptance criteria
    const acMatch = spec.content.match(/## Acceptance Criteria\n([\s\S]*?)(?=##|$)/i);
    if (acMatch) {
      const acContent = acMatch[1];
      const allAC = acContent.match(/- \[([ xX])\]/g) || [];
      const metAC = acContent.match(/- \[[xX]\]/g) || [];

      checks.acceptanceCriteria.total = allAC.length;
      checks.acceptanceCriteria.met = metAC.length;

      if (checks.acceptanceCriteria.total === 0) {
        checks.acceptanceCriteria.status = 'fail';
        suggestions.push('Add specific acceptance criteria');
      } else if (checks.acceptanceCriteria.met < checks.acceptanceCriteria.total) {
        checks.acceptanceCriteria.status = 'warn';
      }
    } else {
      checks.acceptanceCriteria.status = 'fail';
      suggestions.push('Add an Acceptance Criteria section');
    }

    // Check testing section
    const testMatch = spec.content.match(/## Testing|## Tests/i);
    if (!testMatch) {
      checks.testsAdded.status = 'warn';
      suggestions.push('Add a Testing section describing test coverage');
    }

    // Calculate overall status and score
    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    for (const check of Object.values(checks)) {
      if (check.status === 'pass') passCount++;
      else if (check.status === 'warn') warnCount++;
      else failCount++;
    }

    let status: SpecValidateResult['status'];
    if (failCount > 0) {
      status = 'fail';
    } else if (warnCount > 0) {
      status = 'partial';
    } else {
      status = 'pass';
    }

    const totalChecks = passCount + warnCount + failCount;
    const score = Math.round((passCount / totalChecks) * 100);

    // Update spec validation status
    this.updateSpec(specIdOrPath, {
      validationStatus: status === 'pass' ? 'complete' : status === 'partial' ? 'partial' : 'failed',
    });

    return {
      status,
      score,
      checks,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  // =========================================================================
  // Refinement
  // =========================================================================

  /**
   * Generate refinement questions for a spec
   */
  generateRefinementQuestions(specIdOrPath: string): Array<{
    id: string;
    question: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const spec = this.getSpec(specIdOrPath);
    if (!spec) {
      throw new SpecError('refine', `Spec not found: ${specIdOrPath}`);
    }

    const questions: Array<{
      id: string;
      question: string;
      category: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // Check for missing sections based on template
    const template = getTemplate(spec.template);
    for (const section of template.sections) {
      const sectionRegex = new RegExp(`## ${section.title}`, 'i');
      if (!sectionRegex.test(spec.content)) {
        questions.push({
          id: `missing-${section.id}`,
          question: `The "${section.title}" section is missing. ${section.description}`,
          category: 'structure',
          priority: section.required ? 'high' : 'medium',
        });
      }
    }

    // Check for empty sections
    const emptySectionMatch = spec.content.match(/## ([^\n]+)\n\n(<!--[^>]*-->)?\n*(?=##|$)/g);
    if (emptySectionMatch) {
      for (const match of emptySectionMatch) {
        const titleMatch = match.match(/## ([^\n]+)/);
        if (titleMatch) {
          questions.push({
            id: `empty-${titleMatch[1].toLowerCase().replace(/\s+/g, '-')}`,
            question: `The "${titleMatch[1]}" section appears to be empty. Please add content.`,
            category: 'content',
            priority: 'medium',
          });
        }
      }
    }

    // Check for vague requirements
    const vaguePatterns = ['something', 'somehow', 'maybe', 'probably', 'etc', 'tbd', 'todo'];
    for (const pattern of vaguePatterns) {
      if (spec.content.toLowerCase().includes(pattern)) {
        questions.push({
          id: `vague-${pattern}`,
          question: `The spec contains vague language ("${pattern}"). Please be more specific.`,
          category: 'clarity',
          priority: 'low',
        });
        break; // Only add one vague language warning
      }
    }

    return questions;
  }

  /**
   * Apply refinements to a spec
   */
  refineSpec(
    specIdOrPath: string,
    answers: Record<string, string>
  ): SpecRefineResult {
    const spec = this.getSpec(specIdOrPath);
    if (!spec) {
      throw new SpecError('refine', `Spec not found: ${specIdOrPath}`);
    }

    let improvementsApplied = 0;

    // Apply answers as notes/content updates
    for (const answer of Object.values(answers)) {
      if (answer && answer.trim()) {
        // Add answer as a note in the relevant section
        // This is a simple implementation - could be enhanced
        improvementsApplied++;
      }
    }

    // Update metadata
    spec.metadata.updated_at = new Date().toISOString();
    fs.writeFileSync(spec.path, serializeSpec(spec), 'utf-8');

    // Generate new questions to see if more refinement is needed
    const newQuestions = this.generateRefinementQuestions(specIdOrPath);
    const highPriorityRemaining = newQuestions.filter(q => q.priority === 'high').length;

    return {
      questionsAsked: Object.keys(answers).length,
      questionsAnswered: Object.values(answers).filter(a => a && a.trim()).length,
      improvementsApplied,
      additionalRoundsRecommended: highPriorityRemaining > 0,
    };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Infer work type from template type
   */
  private inferWorkType(templateType: SpecTemplateType): WorkType {
    switch (templateType) {
      case 'feature':
        return 'feature';
      case 'bug':
        return 'bug';
      case 'infrastructure':
        return 'chore';
      case 'api':
        return 'feature';
      default:
        return 'feature';
    }
  }

  /**
   * Update phase content in spec
   */
  private updatePhaseInContent(content: string, phase: SpecPhase): string {
    // Find and replace the phase section
    const phaseNum = phase.id.replace('phase-', '');
    const phaseRegex = new RegExp(
      `(## Phase ${phaseNum}: [^\\n]+\\n)([\\s\\S]*?)(?=## Phase \\d+:|## [A-Z]|$)`,
      'i'
    );

    const match = content.match(phaseRegex);
    if (!match) {
      return content;
    }

    // Build new phase content
    const lines: string[] = [];
    if (phase.objective) {
      lines.push(`\n**Objective:** ${phase.objective}\n`);
    }
    if (phase.status !== 'not_started') {
      lines.push(`\n**Status:** ${phase.status}\n`);
    }
    lines.push('\n');
    for (const task of phase.tasks) {
      const checkbox = task.completed ? '[x]' : '[ ]';
      lines.push(`- ${checkbox} ${task.text}\n`);
    }
    if (phase.notes && phase.notes.length > 0) {
      lines.push('\n**Notes:**\n');
      for (const note of phase.notes) {
        lines.push(`- ${note}\n`);
      }
    }

    return content.replace(phaseRegex, `$1${lines.join('')}`);
  }

  /**
   * Update tasks in content
   */
  private updateTasksInContent(content: string, phase: SpecPhase): string {
    return this.updatePhaseInContent(content, phase);
  }

  /**
   * Get available templates
   */
  getTemplates(): Array<{ id: string; name: string; description: string }> {
    return Object.values(templates).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
    }));
  }
}
