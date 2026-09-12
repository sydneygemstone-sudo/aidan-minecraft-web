#!/bin/bash
cd "$(dirname "$0")"

# Ensure dist exists
if [ ! -d "dist" ]; then
    echo "正在进行初次构建..."
    npm run build
fi

# Open in background
(sleep 1 && open "http://localhost:5173/") &

# Start production LAN server (ignoring Tailscale)
node server.js
