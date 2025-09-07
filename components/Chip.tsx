import React from 'react';

interface ChipProps {
    value: number;
    className?: string;
}

const CHIP_COLORS: { [key: number]: string } = {
    1: 'bg-white text-gray-800 border-gray-400',
    5: 'bg-red-600 text-white border-red-800',
    10: 'bg-blue-600 text-white border-blue-800',
    25: 'bg-green-600 text-white border-green-800',
    100: 'bg-black text-white border-gray-500',
    500: 'bg-purple-600 text-white border-purple-800',
    1000: 'bg-yellow-400 text-black border-yellow-600',
};

export const getChipColor = (value: number): string => {
    if (value >= 1000) return CHIP_COLORS[1000];
    if (value >= 500) return CHIP_COLORS[500];
    if (value >= 100) return CHIP_COLORS[100];
    if (value >= 25) return CHIP_COLORS[25];
    if (value >= 10) return CHIP_COLORS[10];
    if (value >= 5) return CHIP_COLORS[5];
    return CHIP_COLORS[1];
};

const Chip: React.FC<ChipProps> = ({ value, className = '' }) => {
    const colorClasses = getChipColor(value);

    return (
        <div className={`relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 shadow-inner ${colorClasses} ${className}`}>
            <div className="absolute inset-0.5 border-2 border-white/50 rounded-full"></div>
            <span className="z-10">{value}</span>
        </div>
    );
};

export default Chip;