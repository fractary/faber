"""
Work Tracking Example (Python)

Demonstrates comprehensive work tracking operations:
- Creating and fetching issues
- Managing comments and labels
- Classifying work types

Usage:
    GITHUB_TOKEN=xxx python docs/examples/work-tracking.py
"""

import os
import sys
from faber import WorkManager


def main():
    if not os.getenv("GITHUB_TOKEN"):
        print("Error: GITHUB_TOKEN environment variable is required", file=sys.stderr)
        sys.exit(1)

    print("Work Tracking Example\n" + "=" * 50)

    # Initialize WorkManager
    work = WorkManager(
        config={
            "platform": "github",
            "owner": "fractary",  # Change to your org/user
            "repo": "faber",      # Change to your repo
        }
    )

    try:
        # Example 1: Create a new issue
        print("\n📝 Creating new issue...")
        issue = work.create_issue(
            title="Add CSV export feature",
            body=(
                "Users need to export their data as CSV files.\n\n"
                "## Requirements\n"
                "- Support all data types\n"
                "- Include headers\n"
                "- Handle large datasets"
            ),
            labels=["enhancement", "feature"],
            assignees=[],  # Add assignee usernames if needed
        )

        print(f"✓ Created issue #{issue['number']}: {issue['title']}")
        print(f"  URL: {issue['url']}")

        # Example 2: Classify work type
        print("\n🔍 Classifying work type...")
        work_type = work.classify_work_type(issue)
        print(f"✓ Classified as: {work_type}")

        # Example 3: Add a comment
        print("\n💬 Adding comment...")
        comment = work.create_comment(
            issue["number"],
            "Starting analysis for this feature.\n\nWill provide spec within 24 hours.",
            faber_context={"phase": "frame", "workflow_id": "WF-example"},
        )
        print("✓ Added comment")

        # Example 4: Add labels
        print("\n🏷️  Adding labels...")
        work.add_labels(issue["number"], ["needs-spec", "high-priority"])
        print("✓ Added labels: needs-spec, high-priority")

        # Example 5: Fetch issue with updates
        print("\n📥 Fetching updated issue...")
        updated = work.fetch_issue(issue["number"])
        print(f"✓ Issue #{updated['number']}")
        print(f"  Title: {updated['title']}")
        print(f"  State: {updated['state']}")
        print(f"  Labels: {', '.join(l['name'] for l in updated['labels'])}")
        comments = work.list_comments(issue["number"])
        print(f"  Comments: {len(comments)}")

        # Example 6: Search for issues
        print("\n🔎 Searching for feature requests...")
        features = work.search_issues("", labels=["feature"], state="open")
        print(f"✓ Found {len(features)} open feature requests")
        for f in features[:3]:
            print(f"  - #{f['number']}: {f['title']}")

        # Example 7: List all labels
        print("\n🏷️  Repository labels:")
        all_labels = work.list_labels()
        print(f"✓ Found {len(all_labels)} labels")
        for l in all_labels[:5]:
            print(f"  - {l['name']} ({l['color']})")

        # Example 8: Close the example issue
        print("\n🔒 Closing example issue...")
        work.close_issue(issue["number"])
        print(f"✓ Closed issue #{issue['number']}")

        print("\n" + "=" * 50)
        print("Work tracking example completed successfully!")

    except Exception as error:
        print(f"\n❌ Error: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
