#!/bin/bash
# A script to kill processes running on one or more specified ports.

if [ $# -eq 0 ]; then
  echo "Usage: $0 <port1> <port2> ..."
  exit 1
fi

for PORT in "$@"; do
  # The '-sTCP:LISTEN' flag ensures we only get listening processes,
  # and '-t' gives us just the PID.
  PID=$(lsof -t -i:$PORT -sTCP:LISTEN)

  if [ -z "$PID" ]; then
    echo "No process found listening on port $PORT."
  else
    echo "Process(es) with PID(s) $PID found on port $PORT. Killing..."
    # kill -9 can handle multiple PIDs at once.
    kill -9 $PID
    echo "Process(es) on port $PORT killed."
  fi
done
