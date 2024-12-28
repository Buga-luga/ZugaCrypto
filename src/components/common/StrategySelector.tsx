'use client';

import { strategies } from '../../services/strategies';

interface StrategySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function StrategySelector({ value, onChange }: StrategySelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400">Strategy:</span>
      <select
        className="bg-[#1E222D] text-white px-2 py-1 rounded border border-gray-700"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="none">None</option>
        {strategies.map(strategy => (
          <option key={strategy.name} value={strategy.name}>
            {strategy.label}
          </option>
        ))}
      </select>
    </div>
  );
}
