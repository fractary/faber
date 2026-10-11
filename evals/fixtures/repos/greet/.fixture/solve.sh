#!/bin/sh
# Eval fixture: stands in for an agent by writing the change the work item asks for.
cat > greet.sh <<'GREET'
#!/bin/sh
# Print a greeting for the name given as the first argument.
echo "Hello, $1!"
GREET
