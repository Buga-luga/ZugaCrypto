import os
import subprocess
import sys
import time
import psutil
from typing import List, Optional
from pathlib import Path
import winreg  # For Windows registry access
import json
import shutil

class ZugaCryptoDevRunner:
    def __init__(self):
        self.root_dir = os.path.dirname(os.path.abspath(__file__))
        self.npm_path = self.find_npm()
        self.port = 3001
        self.required_packages = [
            "react@18.2.0",
            "react-dom@18.2.0",
            "next@14.2.22",
            "@types/react@^19.0.2",
            "@types/react-dom@^19",
            "typescript@^5",
            "@types/node@^20",
            "postcss@^8",
            "tailwindcss@^3.4.1",
            "eslint@^9",
            "eslint-config-next@14.2.22",
            "@eslint/eslintrc@^3",
            "lightweight-charts@^4.2.2",
            "axios@^1.7.9",
            "ws@^8.18.0",
            "autoprefixer@^10.0.1"
        ]

    def kill_process_on_port(self, port: int) -> bool:
        """Kill any process using the specified port."""
        try:
            for proc in psutil.process_iter(['pid', 'name', 'connections']):
                try:
                    connections = proc.connections()
                    for conn in connections:
                        if conn.laddr.port == port:
                            print(f"Found process using port {port}: {proc.name()} (PID: {proc.pid})")
                            proc.kill()
                            print(f"✅ Killed process on port {port}")
                            return True
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            print(f"Error checking port {port}: {e}")
        return False

    def clean_project(self):
        """Clean the project by removing cache and node_modules."""
        print("🧹 Cleaning project...")
        try:
            paths_to_remove = [
                os.path.join(self.root_dir, '.next'),
                os.path.join(self.root_dir, 'node_modules'),
                os.path.join(self.root_dir, 'package-lock.json')
            ]
            
            for path in paths_to_remove:
                if os.path.exists(path):
                    if os.path.isdir(path):
                        shutil.rmtree(path, ignore_errors=True)
                    else:
                        os.remove(path)
            print("✅ Project cleaned successfully!")
        except Exception as e:
            print(f"⚠️ Error cleaning project: {e}")

    def get_nodejs_path_from_registry(self) -> Optional[str]:
        """Get Node.js installation path from Windows registry."""
        try:
            with winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Node.js",
                0,
                winreg.KEY_READ | winreg.KEY_WOW64_32KEY
            ) as key:
                return winreg.QueryValueEx(key, "InstallPath")[0]
        except WindowsError:
            return None

    def find_node_executable(self) -> Optional[tuple[str, str]]:
        """Find Node.js and npm executables."""
        print("🔍 Searching for Node.js installation...")
        
        # Try to get path from registry first
        registry_path = self.get_nodejs_path_from_registry()
        if registry_path:
            print(f"Found Node.js path in registry: {registry_path}")
            node_path = os.path.join(registry_path, "node.exe")
            npm_path = os.path.join(registry_path, "npm.cmd")
            if os.path.isfile(node_path) and os.path.isfile(npm_path):
                return node_path, npm_path

        # Common installation paths
        possible_paths = [
            r"C:\Program Files\nodejs",
            r"C:\Program Files (x86)\nodejs",
            os.path.expandvars(r"%APPDATA%\npm"),
            os.path.expandvars(r"%ProgramFiles%\nodejs"),
            os.path.expandvars(r"%ProgramFiles(x86)%\nodejs"),
        ]

        print("Checking common installation paths:")
        for base_path in possible_paths:
            print(f"Checking {base_path}...")
            node_path = os.path.join(base_path, "node.exe")
            npm_path = os.path.join(base_path, "npm.cmd")
            if os.path.isfile(node_path) and os.path.isfile(npm_path):
                print(f"✅ Found Node.js in: {base_path}")
                return node_path, npm_path

        # Try PATH environment variable
        print("Checking PATH environment variable...")
        for path in os.environ["PATH"].split(os.pathsep):
            node_path = os.path.join(path, "node.exe")
            npm_path = os.path.join(path, "npm.cmd")
            if os.path.isfile(node_path) and os.path.isfile(npm_path):
                print(f"✅ Found Node.js in PATH: {path}")
                return node_path, npm_path

        return None

    def run_command(self, cmd: List[str], **kwargs) -> subprocess.CompletedProcess:
        """Run a command with better error handling."""
        print(f"📎 Running command: {' '.join(cmd)}")
        try:
            return subprocess.run(cmd, **kwargs)
        except subprocess.CalledProcessError as e:
            print(f"❌ Command failed with exit code {e.returncode}")
            print(f"Command output: {e.output.decode() if e.output else 'No output'}")
            raise
        except Exception as e:
            print(f"❌ Unexpected error running command: {e}")
            raise

    def check_node_npm(self) -> bool:
        executables = self.find_node_executable()
        if not executables:
            print("\n❌ Node.js and npm are required but not found!")
            print("Please install Node.js from https://nodejs.org/")
            print("\nAfter installation:")
            print("1. Close and reopen your terminal")
            print("2. Run 'node --version' to verify installation")
            return False

        node_path, npm_path = executables
        try:
            node_version = self.run_command(
                [node_path, "--version"],
                capture_output=True,
                text=True,
                check=True
            ).stdout.strip()
            
            npm_version = self.run_command(
                [npm_path, "--version"],
                capture_output=True,
                text=True,
                check=True
            ).stdout.strip()
            
            print(f"✅ Found Node.js {node_version}")
            print(f"✅ Found npm {npm_version}")
            
            # Store paths for later use
            self.node_path = node_path
            self.npm_path = npm_path
            return True
        except Exception as e:
            print(f"❌ Error verifying Node.js/npm: {e}")
            return False

    def find_npm(self):
        """Find the npm executable path."""
        if sys.platform == "win32":
            npm_cmd = "npm.cmd"
        else:
            npm_cmd = "npm"

        # First try to find npm in PATH
        npm_path = shutil.which(npm_cmd)
        if npm_path:
            return npm_path

        # Common npm locations on Windows
        common_locations = [
            os.path.join(os.environ.get('APPDATA', ''), 'npm', npm_cmd),
            os.path.join(os.environ.get('ProgramFiles', ''), 'nodejs', npm_cmd),
            os.path.join(os.environ.get('ProgramFiles(x86)', ''), 'nodejs', npm_cmd),
        ]

        for location in common_locations:
            if os.path.isfile(location):
                return location

        raise FileNotFoundError(f"Could not find {npm_cmd}. Please ensure Node.js is installed.")

    def install_dependencies(self):
        print("📦 Installing dependencies...")
        try:
            # First try without --legacy-peer-deps
            try:
                cmd = [self.npm_path, "install", "--force"] + self.required_packages
                self.run_command(cmd, check=True, cwd=self.root_dir)
            except subprocess.CalledProcessError:
                print("⚠️ Initial installation failed, trying with --legacy-peer-deps...")
                cmd = [self.npm_path, "install", "--force", "--legacy-peer-deps"] + self.required_packages
                self.run_command(cmd, check=True, cwd=self.root_dir)
            
            print("✅ Dependencies installed successfully!")
        except Exception as e:
            print(f"❌ Failed to install dependencies: {e}")
            sys.exit(1)

    def check_typescript_errors(self) -> bool:
        print("🔍 Checking TypeScript errors...")
        try:
            result = self.run_command(
                [self.npm_path, "exec", "tsc", "--", "--noEmit"],
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                print("⚠️ TypeScript errors found:")
                print(result.stdout)
                return False
            print("✅ TypeScript check passed!")
            return True
        except Exception as e:
            print(f"⚠️ TypeScript check failed: {e}")
            return False

    def start_dev_server(self):
        print(f"🚀 Starting development server on port {self.port}...")
        try:
            # Kill any process using our target port
            self.kill_process_on_port(self.port)
            
            # Set environment variables for the server
            env = os.environ.copy()
            env["PORT"] = str(self.port)
            env["NODE_ENV"] = "development"
            
            # Start the development server
            server_process = subprocess.Popen(
                [self.npm_path, "run", "dev"],
                env=env,
                cwd=self.root_dir
            )
            
            # Wait a bit for the server to start
            time.sleep(2)
            
            print(f"✅ Development server running at http://localhost:{self.port}")
            print("Press Ctrl+C to stop the server")
            
            try:
                server_process.wait()
            except KeyboardInterrupt:
                print("\n👋 Shutting down development server...")
                server_process.terminate()
                try:
                    server_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server_process.kill()
        except Exception as e:
            print(f"❌ Failed to start development server: {e}")
            sys.exit(1)

    def setup_typescript(self):
        print("🔧 Setting up TypeScript configuration...")
        try:
            # Create tsconfig.json
            tsconfig = {
                "compilerOptions": {
                    "target": "ES2017",
                    "lib": ["dom", "dom.iterable", "esnext"],
                    "allowJs": True,
                    "skipLibCheck": True,
                    "strict": True,
                    "noEmit": True,
                    "esModuleInterop": True,
                    "module": "esnext",
                    "moduleResolution": "bundler",
                    "resolveJsonModule": True,
                    "isolatedModules": True,
                    "jsx": "preserve",
                    "incremental": True,
                    "plugins": [
                        {
                            "name": "next"
                        }
                    ],
                    "paths": {
                        "@/*": ["./src/*"]
                    }
                },
                "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
                "exclude": ["node_modules"]
            }
            
            with open('tsconfig.json', 'w') as f:
                json.dump(tsconfig, f, indent=2)
            print("✅ TypeScript configuration created!")
        except Exception as e:
            print(f"❌ Failed to setup TypeScript: {e}")
            sys.exit(1)

    def setup_package_json(self):
        print("📝 Setting up package.json...")
        package_json = {
            "name": "zugacrypto",
            "version": "0.1.0",
            "private": True,
            "scripts": {
                "dev": "next dev",
                "build": "next build",
                "start": "next start",
                "lint": "next lint"
            },
            "dependencies": {
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "next": "^14.2.22",
                "lightweight-charts": "^4.2.2",
                "axios": "^1.7.9",
                "ws": "^8.18.0"
            },
            "devDependencies": {
                "typescript": "^5",
                "@types/node": "^20",
                "@types/react": "^19",
                "@types/react-dom": "^19",
                "postcss": "^8",
                "tailwindcss": "^3.4.1",
                "eslint": "^9",
                "eslint-config-next": "^14.2.22",
                "@eslint/eslintrc": "^3",
                "autoprefixer": "^10.0.1"
            }
        }
        
        with open('package.json', 'w') as f:
            json.dump(package_json, f, indent=2)
        print("✅ package.json configured successfully!")

    def setup_project_structure(self):
        print("📁 Setting up project structure...")
        try:
            # Create all directories
            directories = [
                'src/app',
                'src/components/Chart',
                'src/components/Strategy',
                'src/components/common',
                'src/services/api',
                'src/services/strategies',
                'src/types',
                'src/utils'
            ]
            
            for directory in directories:
                os.makedirs(os.path.join(self.root_dir, directory), exist_ok=True)

            # Create all required files
            files = {
                'src/app/page.tsx': """
'use client';
import { useState } from 'react';
import { CandlestickChart } from '@/components/Chart/CandlestickChart';
import { TimeframeSelector } from '@/components/common/TimeframeSelector';

export default function Home() {
  const [timeframe, setTimeframe] = useState('1m');
  return (
    <main className="flex flex-col h-screen bg-[#1E222D]">
      <div className="flex-1 min-h-0 relative">
        <CandlestickChart timeframe={timeframe} />
      </div>
      <div className="p-4 border-t border-[#2B2B43]">
        <TimeframeSelector timeframe={timeframe} setTimeframe={setTimeframe} />
      </div>
    </main>
  );
}""",
                'src/components/Chart/CandlestickChart.tsx': """
'use client';
import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';

export interface CandlestickChartProps {
  timeframe: string;
}

export function CandlestickChart({ timeframe }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions = {
      layout: {
        background: { color: '#1E222D' },
        textColor: '#DDD',
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#758696',
          style: 3,
        },
        horzLine: {
          width: 1,
          color: '#758696',
          style: 3,
        },
      },
      timeScale: {
        borderColor: '#2B2B43',
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
      },
    };

    const chart = createChart(chartContainerRef.current, {
      ...chartOptions,
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Sample data - replace with your actual data fetching logic
    const sampleData = [
      { time: '2024-01-01', open: 100, high: 105, low: 95, close: 102 },
      { time: '2024-01-02', open: 102, high: 108, low: 100, close: 107 },
      { time: '2024-01-03', open: 107, high: 110, low: 105, close: 106 },
    ];

    candlestickSeries.setData(sampleData);
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [timeframe]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
}""",
                'src/components/common/TimeframeSelector.tsx': """
'use client';
import { Dispatch, SetStateAction } from 'react';

interface TimeframeSelectorProps {
  timeframe: string;
  setTimeframe: Dispatch<SetStateAction<string>>;
}

export function TimeframeSelector({ timeframe, setTimeframe }: TimeframeSelectorProps) {
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
  return (
    <div className="flex items-center space-x-1 bg-[#2B2B43] rounded-lg p-1">
      {timeframes.map((tf) => (
        <button
          key={tf}
          className={`px-4 py-2 rounded-md transition-colors duration-200 ${
            timeframe === tf
              ? 'bg-blue-500 text-white shadow-lg'
              : 'text-gray-300 hover:bg-[#363853] hover:text-white'
          }`}
          onClick={() => setTimeframe(tf)}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}""",
                'src/app/globals.css': """
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 255, 255, 255;
  --background-rgb: 30, 34, 45;
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
}""",
                'next.config.js': """
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    PORT: 3001
  },
  experimental: {
    swcMinify: true,
  },
}

module.exports = nextConfig""",
                'postcss.config.js': """
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}""",
                'tailwind.config.js': """
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}"""
            }

            for file_path, content in files.items():
                with open(os.path.join(self.root_dir, file_path), 'w') as f:
                    f.write(content.strip())

            print("✅ Project structure created successfully!")
        except Exception as e:
            print(f"❌ Failed to setup project structure: {e}")
            sys.exit(1)

    def run(self):
        print("🔧 Starting ZugaCrypto development environment...")
        
        if not self.check_node_npm():
            return

        # Clean the project first
        self.clean_project()
        
        self.setup_package_json()
        self.setup_typescript()
        self.setup_project_structure()
        self.install_dependencies()
        
        if not self.check_typescript_errors():
            user_input = input("Continue despite TypeScript errors? (y/N): ")
            if user_input.lower() != 'y':
                return

        self.start_dev_server()

if __name__ == "__main__":
    try:
        runner = ZugaCryptoDevRunner()
        runner.run()
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
        sys.exit(0) 