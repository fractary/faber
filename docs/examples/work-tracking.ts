/**
 * Work Tracking Example (TypeScript)
 *
 * Demonstrates comprehensive work tracking operations:
 * - Creating and fetching issues
 * - Managing comments and labels
 * - Classifying work types
 *
 * Usage:
 *   GITHUB_TOKEN=xxx npx tsx docs/examples/work-tracking.ts
 */

import { WorkManager } from '@fractary/faber/work';
import type { Issue, WorkType } from '@fractary/faber';

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('Work Tracking Example\n' + '='.repeat(50));

  // Initialize WorkManager
  const work = new WorkManager({
    platform: 'github',
    owner: 'fractary',  // Change to your org/user
    repo: 'faber',      // Change to your repo
  });

  try {
    // Example 1: Create a new issue
    console.log('\n📝 Creating new issue...');
    const issue: Issue = await work.createIssue({
      title: 'Add CSV export feature',
      body: 'Users need to export their data as CSV files.\n\n## Requirements\n- Support all data types\n- Include headers\n- Handle large datasets',
      labels: ['enhancement', 'feature'],
      assignees: [], // Add assignee usernames if needed
    });

    console.log(`✓ Created issue #${issue.number}: ${issue.title}`);
    console.log(`  URL: ${issue.url}`);

    // Example 2: Classify work type
    console.log('\n🔍 Classifying work type...');
    const workType: WorkType = await work.classifyWorkType(issue);
    console.log(`✓ Classified as: ${workType}`);

    // Example 3: Add a comment
    console.log('\n💬 Adding comment...');
    const comment = await work.createComment(
      issue.number,
      'Starting analysis for this feature.\n\nWill provide spec within 24 hours.',
      {
        phase: 'frame',
        workflowId: 'WF-example',
      }
    );
    console.log(`✓ Added comment`);

    // Example 4: Add labels
    console.log('\n🏷️  Adding labels...');
    await work.addLabels(issue.number, ['needs-spec', 'high-priority']);
    console.log(`✓ Added labels: needs-spec, high-priority`);

    // Example 5: Fetch issue with updates
    console.log('\n📥 Fetching updated issue...');
    const updated = await work.fetchIssue(issue.number);
    console.log(`✓ Issue #${updated.number}`);
    console.log(`  Title: ${updated.title}`);
    console.log(`  State: ${updated.state}`);
    console.log(`  Labels: ${updated.labels.map((l) => l.name).join(', ')}`);
    console.log(`  Comments: ${await getCommentCount(work, issue.number)}`);

    // Example 6: Search for issues
    console.log('\n🔎 Searching for feature requests...');
    const features = await work.searchIssues('', {
      labels: ['feature'],
      state: 'open',
    });
    console.log(`✓ Found ${features.length} open feature requests`);
    features.slice(0, 3).forEach((f) => {
      console.log(`  - #${f.number}: ${f.title}`);
    });

    // Example 7: List all labels
    console.log('\n🏷️  Repository labels:');
    const allLabels = await work.listLabels();
    console.log(`✓ Found ${allLabels.length} labels`);
    allLabels.slice(0, 5).forEach((l) => {
      console.log(`  - ${l.name} (${l.color})`);
    });

    // Example 8: Close the example issue
    console.log('\n🔒 Closing example issue...');
    await work.closeIssue(issue.number);
    console.log(`✓ Closed issue #${issue.number}`);

    console.log('\n' + '='.repeat(50));
    console.log('Work tracking example completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function getCommentCount(work: WorkManager, issueNumber: number): Promise<number> {
  const comments = await work.listComments(issueNumber);
  return comments.length;
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
