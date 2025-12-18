"""
Simple FABER Workflow Example (Python)

Demonstrates basic workflow execution for a work item.

Usage:
    GITHUB_TOKEN=xxx python docs/examples/simple-workflow.py 123
"""

import os
import sys
from faber.workflow import FaberWorkflow


def main():
    if len(sys.argv) < 2:
        print("Usage: python simple-workflow.py <work-id>", file=sys.stderr)
        sys.exit(1)

    work_id = sys.argv[1]

    if not os.getenv("GITHUB_TOKEN"):
        print("Error: GITHUB_TOKEN environment variable is required", file=sys.stderr)
        sys.exit(1)

    print(f"Running FABER workflow for work item #{work_id}...")

    # Initialize FABER with configuration
    faber = FaberWorkflow(
        config={
            "autonomy": "assisted",
            "phases": {
                "frame": {"enabled": True},
                "architect": {"enabled": True, "refine_spec": True},
                "build": {"enabled": True},
                "evaluate": {"enabled": True, "max_retries": 3},
                "release": {"enabled": True, "request_reviews": True},
            },
        }
    )

    # Add event listener for workflow progress
    def event_listener(event, data):
        print(f"[{event}]", data)

        # Log phase transitions
        if event == "phase:start":
            print(f"→ Starting phase: {data['phase']}")
        elif event == "phase:complete":
            print(f"✓ Completed phase: {data['phase']}")
        elif event == "phase:fail":
            print(f"✗ Failed phase: {data['phase']}", data.get("error"))

    faber.add_event_listener(event_listener)

    # Set up user input callback for assisted mode
    def user_input_callback(request):
        print(f"\n🤔 {request['message']}")
        print("   (Automatically approving for this example)")
        return True  # Auto-approve for example purposes

    faber.set_user_input_callback(user_input_callback)

    try:
        # Run the workflow
        result = faber.run(work_id=work_id, autonomy="assisted")

        # Display results
        print("\n" + "=" * 50)
        print("Workflow completed successfully!")
        print("=" * 50)
        print(f"Workflow ID: {result['workflow_id']}")
        print(f"Work ID: {result['work_id']}")
        print(f"Status: {result['status']}")
        print(f"Duration: {result['duration_ms'] / 1000:.2f}s")

        print("\nPhases:")
        for phase in result["phases"]:
            duration = (
                f" ({phase['duration_ms'] / 1000:.2f}s)"
                if phase.get("duration_ms")
                else ""
            )
            print(f"  - {phase['phase']}: {phase['status']}{duration}")

        if result.get("artifacts"):
            print("\nArtifacts:")
            for artifact in result["artifacts"]:
                print(f"  - {artifact['type']}: {artifact['path']}")

    except Exception as error:
        print("\n" + "=" * 50, file=sys.stderr)
        print("Workflow failed!", file=sys.stderr)
        print("=" * 50, file=sys.stderr)
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
