#!/usr/bin/env bash

cd /home/ales/Desktop/RolfBot || exit 1
trap 'exit 0' INT TERM

echo "[SHELL INFO]: starting..."

while true; do
  node index.js
  code=$?

  if [ "$code" -eq 42 ] || [ "$code" -eq 130 ] || [ "$code" -eq 143 ]; then
    echo "[SHELL INFO]: stopped."
    break
  fi

  if [ "$code" -ne 0 ]; then
    echo "[SHELL ERROR]: crashed ($code)."
  fi

  echo "[SHELL INFO]: restarting in 1 second..."
  sleep 1
done