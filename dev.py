#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys
from pathlib import Path

def run_command(command, cwd=None):
    """Run a command and print its output in real-time."""
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        shell=True,
        cwd=cwd
    )
    
    while True:
        output = process.stdout.readline()
        if output == '' and process.poll() is not None:
            break
        if output:
            print(output.strip())
    
    return process.poll()

def clean_project():
    """Clean out all build artifacts and dependencies."""
    print("\n🧹 Cleaning project...")
    
    # Directories to remove
    dirs_to_remove = [
        'node_modules',
        '.next',
        '.cache',
        'dist',
        'build'
    ]
    
    # Files to remove
    files_to_remove = [
        'yarn.lock',
        'package-lock.json',
        'pnpm-lock.yaml'
    ]
    
    for dir_name in dirs_to_remove:
        if os.path.exists(dir_name):
            print(f"Removing {dir_name}/")
            shutil.rmtree(dir_name)
    
    for file_name in files_to_remove:
        if os.path.exists(file_name):
            print(f"Removing {file_name}")
            os.remove(file_name)

def rebuild_project():
    """Reinstall dependencies and rebuild the project."""
    print("\n📦 Installing dependencies...")
    
    # Clear npm cache
    run_command("npm cache clean --force")
    
    # First try normal install
    print("Attempting normal install...")
    result = run_command("npm install")
    
    # If normal install fails, try with legacy-peer-deps
    if result != 0:
        print("\nNormal install failed, trying with --legacy-peer-deps...")
        result = run_command("npm install --legacy-peer-deps")
        if result != 0:
            print("Failed to install dependencies even with --legacy-peer-deps")
            sys.exit(1)
    
    print("\n🏗️ Building project...")
    result = run_command("npm run build")
    if result != 0:
        print("Failed to build project")
        sys.exit(1)

def start_dev_server():
    """Start the development server."""
    print("\n🚀 Starting development server...")
    try:
        # Run npm run dev
        run_command("npm run dev")
    except KeyboardInterrupt:
        print("\n👋 Shutting down server...")
        sys.exit(0)

def main():
    print("🚀 Starting project cleanup and rebuild...")
    
    # Clean everything
    clean_project()
    
    # Rebuild
    rebuild_project()
    
    print("\n✨ Project cleanup and rebuild complete!")
    
    # Start the development server
    start_dev_server()

if __name__ == "__main__":
    main() 