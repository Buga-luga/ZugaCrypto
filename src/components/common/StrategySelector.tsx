'use client';
import { useEffect } from 'react';
import { StrategyId, getAllStrategies } from '@/services/strategies';

interface StrategySelectorProps {
  value: StrategyId;
  onChange: (value: StrategyId) => void;
}

export function StrategySelector({ value, onChange }: StrategySelectorProps) {
  useEffect(() => {
    // Load strategies immediately
    const strategies = getAllStrategies();
    console.log('Available strategies:', strategies);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as StrategyId);
  };

  // Get all strategies except 'none'
  const strategies = getAllStrategies().filter(strategy => strategy.id !== 'none');

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-300">Strategy:</span>
      <select
        value={value}
        onChange={handleChange}
        className="bg-[#2B2B43] text-gray-300 px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
      >
        <option value="none">None</option>
        {strategies.map((strategy) => (
          <option key={strategy.id} value={strategy.id}>
            {strategy.name}
          </option>
        ))}
      </select>
    </div>
  );
}
