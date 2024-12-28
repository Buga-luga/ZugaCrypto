'use client';
import { useEffect, useState } from 'react';
import { Strategy, StrategyId, getStrategies } from '@/services/strategies';

interface StrategySelectorProps {
  selectedStrategy: StrategyId;
  onStrategyChange: (strategy: StrategyId) => void;
}

export function StrategySelector({ selectedStrategy, onStrategyChange }: StrategySelectorProps) {
  const [availableStrategies, setAvailableStrategies] = useState<Strategy[]>([]);

  useEffect(() => {
    // Load strategies immediately
    setAvailableStrategies(getStrategies());
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400">Strategy:</span>
      <select
        value={selectedStrategy}
        onChange={(e) => onStrategyChange(e.target.value as StrategyId)}
        className="bg-[#1E222D] text-white border border-[#2B2B43] rounded px-3 py-2 focus:outline-none focus:border-[#758696]"
      >
        <option value="none">No Strategy</option>
        {availableStrategies.map((strategy) => (
          <option key={strategy.id} value={strategy.id}>
            {strategy.name}
          </option>
        ))}
      </select>
    </div>
  );
}
