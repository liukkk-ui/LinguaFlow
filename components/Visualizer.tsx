import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  volume: number; // 0 to 1
  isActive: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive }) => {
  // Create a smooth volume value
  const smoothVol = useRef(0);

  useEffect(() => {
    if (isActive) {
      smoothVol.current = smoothVol.current * 0.8 + volume * 0.2;
    } else {
      smoothVol.current = 0;
    }
  }, [volume, isActive]);

  // Generate 4 bars with different height multipliers
  const bars = [0.8, 1.2, 1.0, 0.6];

  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {bars.map((mult, idx) => (
        <div
          key={idx}
          className={`w-1.5 bg-blue-600 rounded-full transition-all duration-75 ease-out visualizer-bar`}
          style={{
            height: isActive ? `${Math.max(4, Math.min(24, volume * 100 * mult))}px` : '4px',
            opacity: isActive ? 1 : 0.3
          }}
        />
      ))}
    </div>
  );
};

export default Visualizer;
