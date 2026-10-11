#!/bin/sh
# Answer key: greet.sh prints a greeting for the name it is given.
out=$(sh greet.sh World)
if [ "$out" != "Hello, World!" ]; then
  echo "expected 'Hello, World!', got '$out'"
  exit 1
fi
