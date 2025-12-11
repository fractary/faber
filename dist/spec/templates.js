"use strict";
/**
 * @fractary/faber - Spec Templates
 *
 * Built-in specification templates for different work types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.templates = void 0;
exports.getTemplate = getTemplate;
exports.listTemplates = listTemplates;
exports.generateSpecContent = generateSpecContent;
/**
 * Basic template - minimal structure for simple tasks
 */
const basicTemplate = {
    id: 'basic',
    name: 'Basic',
    description: 'Minimal template for simple tasks and quick changes',
    sections: [
        {
            id: 'objective',
            title: 'Objective',
            required: true,
            description: 'What needs to be accomplished',
            defaultContent: '<!-- Describe the main goal -->',
        },
        {
            id: 'requirements',
            title: 'Requirements',
            required: true,
            description: 'List of specific requirements',
            defaultContent: '- [ ] Requirement 1\n- [ ] Requirement 2',
        },
        {
            id: 'acceptance-criteria',
            title: 'Acceptance Criteria',
            required: true,
            description: 'How to verify the work is complete',
            defaultContent: '- [ ] Criterion 1\n- [ ] Criterion 2',
        },
    ],
};
/**
 * Feature template - comprehensive structure for new features
 */
const featureTemplate = {
    id: 'feature',
    name: 'Feature',
    description: 'Comprehensive template for new feature development',
    sections: [
        {
            id: 'overview',
            title: 'Overview',
            required: true,
            description: 'High-level description of the feature',
            defaultContent: '<!-- Describe the feature and its value -->',
        },
        {
            id: 'user-stories',
            title: 'User Stories',
            required: true,
            description: 'User stories or use cases',
            defaultContent: '- As a [user type], I want [goal] so that [benefit]',
        },
        {
            id: 'requirements',
            title: 'Requirements',
            required: true,
            description: 'Functional and non-functional requirements',
            defaultContent: '### Functional\n- [ ] Requirement 1\n\n### Non-Functional\n- [ ] Requirement 1',
        },
        {
            id: 'technical-design',
            title: 'Technical Design',
            required: false,
            description: 'Technical approach and architecture decisions',
            defaultContent: '<!-- Describe the technical approach -->',
        },
        {
            id: 'api-changes',
            title: 'API Changes',
            required: false,
            description: 'Any API changes or additions',
            defaultContent: '<!-- Document any API changes -->',
        },
        {
            id: 'data-model',
            title: 'Data Model',
            required: false,
            description: 'Database or data structure changes',
            defaultContent: '<!-- Document data model changes -->',
        },
        {
            id: 'acceptance-criteria',
            title: 'Acceptance Criteria',
            required: true,
            description: 'How to verify the feature is complete',
            defaultContent: '- [ ] Criterion 1\n- [ ] Criterion 2',
        },
        {
            id: 'testing',
            title: 'Testing Strategy',
            required: true,
            description: 'How the feature will be tested',
            defaultContent: '### Unit Tests\n- [ ] Test 1\n\n### Integration Tests\n- [ ] Test 1',
        },
        {
            id: 'rollout',
            title: 'Rollout Plan',
            required: false,
            description: 'How the feature will be deployed',
            defaultContent: '<!-- Describe rollout strategy -->',
        },
    ],
};
/**
 * Bug template - structure for bug fixes
 */
const bugTemplate = {
    id: 'bug',
    name: 'Bug Fix',
    description: 'Template for bug investigation and fixes',
    sections: [
        {
            id: 'description',
            title: 'Bug Description',
            required: true,
            description: 'Description of the bug and its impact',
            defaultContent: '<!-- Describe the bug -->',
        },
        {
            id: 'reproduction',
            title: 'Steps to Reproduce',
            required: true,
            description: 'How to reproduce the bug',
            defaultContent: '1. Step 1\n2. Step 2\n3. Expected: ...\n4. Actual: ...',
        },
        {
            id: 'root-cause',
            title: 'Root Cause Analysis',
            required: false,
            description: 'Investigation findings',
            defaultContent: '<!-- Document root cause -->',
        },
        {
            id: 'solution',
            title: 'Proposed Solution',
            required: true,
            description: 'How the bug will be fixed',
            defaultContent: '<!-- Describe the fix -->',
        },
        {
            id: 'affected-areas',
            title: 'Affected Areas',
            required: true,
            description: 'What parts of the system are affected',
            defaultContent: '- [ ] Component 1\n- [ ] Component 2',
        },
        {
            id: 'testing',
            title: 'Testing',
            required: true,
            description: 'How to verify the fix',
            defaultContent: '- [ ] Regression test\n- [ ] Edge case tests',
        },
    ],
};
/**
 * Infrastructure template - for infrastructure and DevOps work
 */
const infrastructureTemplate = {
    id: 'infrastructure',
    name: 'Infrastructure',
    description: 'Template for infrastructure and DevOps changes',
    sections: [
        {
            id: 'objective',
            title: 'Objective',
            required: true,
            description: 'What infrastructure change is needed',
            defaultContent: '<!-- Describe the objective -->',
        },
        {
            id: 'current-state',
            title: 'Current State',
            required: true,
            description: 'Current infrastructure configuration',
            defaultContent: '<!-- Describe current state -->',
        },
        {
            id: 'proposed-changes',
            title: 'Proposed Changes',
            required: true,
            description: 'What changes will be made',
            defaultContent: '- [ ] Change 1\n- [ ] Change 2',
        },
        {
            id: 'security',
            title: 'Security Considerations',
            required: true,
            description: 'Security implications and mitigations',
            defaultContent: '<!-- Document security considerations -->',
        },
        {
            id: 'rollback',
            title: 'Rollback Plan',
            required: true,
            description: 'How to rollback if something goes wrong',
            defaultContent: '<!-- Document rollback procedure -->',
        },
        {
            id: 'monitoring',
            title: 'Monitoring & Alerts',
            required: false,
            description: 'What monitoring will be added',
            defaultContent: '<!-- Document monitoring changes -->',
        },
        {
            id: 'verification',
            title: 'Verification',
            required: true,
            description: 'How to verify the changes are working',
            defaultContent: '- [ ] Verification step 1\n- [ ] Verification step 2',
        },
    ],
};
/**
 * API template - for API design and implementation
 */
const apiTemplate = {
    id: 'api',
    name: 'API',
    description: 'Template for API design and implementation',
    sections: [
        {
            id: 'overview',
            title: 'Overview',
            required: true,
            description: 'High-level description of the API',
            defaultContent: '<!-- Describe the API purpose -->',
        },
        {
            id: 'endpoints',
            title: 'Endpoints',
            required: true,
            description: 'API endpoint specifications',
            defaultContent: '### `GET /api/v1/resource`\n\n**Description:** ...\n\n**Parameters:**\n- `param1` (string, required): ...\n\n**Response:**\n```json\n{\n  "data": []\n}\n```',
        },
        {
            id: 'authentication',
            title: 'Authentication',
            required: true,
            description: 'How the API is authenticated',
            defaultContent: '<!-- Document auth requirements -->',
        },
        {
            id: 'error-handling',
            title: 'Error Handling',
            required: true,
            description: 'Error codes and responses',
            defaultContent: '| Code | Message | Description |\n|------|---------|-------------|\n| 400 | Bad Request | ... |',
        },
        {
            id: 'rate-limiting',
            title: 'Rate Limiting',
            required: false,
            description: 'Rate limiting configuration',
            defaultContent: '<!-- Document rate limits -->',
        },
        {
            id: 'versioning',
            title: 'Versioning',
            required: false,
            description: 'API versioning strategy',
            defaultContent: '<!-- Document versioning approach -->',
        },
        {
            id: 'testing',
            title: 'Testing',
            required: true,
            description: 'API testing strategy',
            defaultContent: '- [ ] Unit tests\n- [ ] Integration tests\n- [ ] Contract tests',
        },
    ],
};
/**
 * All built-in templates
 */
exports.templates = {
    basic: basicTemplate,
    feature: featureTemplate,
    bug: bugTemplate,
    infrastructure: infrastructureTemplate,
    api: apiTemplate,
};
/**
 * Get a template by type
 */
function getTemplate(type) {
    return exports.templates[type] || exports.templates.basic;
}
/**
 * List all available templates
 */
function listTemplates() {
    return Object.values(exports.templates);
}
/**
 * Generate spec content from a template
 */
function generateSpecContent(template, options) {
    const lines = [];
    // Frontmatter
    lines.push('---');
    lines.push(`id: ${generateSpecId()}`);
    lines.push(`title: "${options.title}"`);
    if (options.workId) {
        lines.push(`work_id: "${options.workId}"`);
    }
    lines.push(`work_type: ${options.workType}`);
    lines.push(`template: ${template.id}`);
    lines.push(`created_at: ${new Date().toISOString()}`);
    lines.push(`updated_at: ${new Date().toISOString()}`);
    lines.push(`validation_status: not_validated`);
    lines.push(`source: conversation`);
    lines.push('---');
    lines.push('');
    // Title
    lines.push(`# ${options.title}`);
    lines.push('');
    // Context if provided
    if (options.context) {
        lines.push('## Context');
        lines.push('');
        lines.push(options.context);
        lines.push('');
    }
    // Template sections
    for (const section of template.sections) {
        lines.push(`## ${section.title}`);
        lines.push('');
        if (section.defaultContent) {
            lines.push(section.defaultContent);
        }
        lines.push('');
    }
    return lines.join('\n');
}
/**
 * Generate a unique spec ID
 */
function generateSpecId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `SPEC-${timestamp}-${random}`.toUpperCase();
}
//# sourceMappingURL=templates.js.map