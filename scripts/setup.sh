#!/usr/bin/env bash

# Universal cross-platform setup dispatcher
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OS="$(uname -s)"

case "${OS}" in
    Darwin*)
        echo "Detected macOS. Launching macOS setup..."
        exec "${SCRIPT_DIR}/setup-mac.sh" "$@"
        ;;
    Linux*)
        echo "Detected Linux. Launching Linux setup..."
        exec "${SCRIPT_DIR}/setup-linux.sh" "$@"
        ;;
    CYGWIN*|MINGW*|MSYS*)
        echo "Detected Windows environment (Bash). Launching Windows PowerShell setup..."
        powershell.exe -ExecutionPolicy Bypass -File "${SCRIPT_DIR}/setup-windows.ps1" "$@"
        ;;
    *)
        echo "Unknown Operating System: ${OS}. Defaulting to POSIX/Linux setup..."
        exec "${SCRIPT_DIR}/setup-linux.sh" "$@"
        ;;
esac
