import React from 'react';
import Chip from './Chip';

interface PotChipsProps {
    amount: number;
}

const CHIP_VALUES = [1000, 500, 100, 25, 10, 5, 1];
const MAX_CHIPS_TO_DISPLAY = 7;

const PotChips: React.FC<PotChipsProps> = ({ amount }) => {
    if (amount <= 0) return null;

    let remainingAmount = amount;
    const chipsToRender: number[] = [];

    for (const value of CHIP_VALUES) {
        let count = Math.floor(remainingAmount / value);
        while(count > 0 && chipsToRender.length < MAX_CHIPS_TO_DISPLAY) {
             chipsToRender.push(value);
             count--;
        }
        if (chipsToRender.length >= MAX_CHIPS_TO_DISPLAY) break;
        remainingAmount %= value;
    }

    return (
        <div className="relative h-10 flex justify-center items-center">
            <div className="flex items-center justify-center -space-x-4">
                {chipsToRender.map((value, index) => (
                    <div 
                        key={index} 
                        className="transform transition-transform duration-300 hover:-translate-y-1"
                        style={{ zIndex: index }}
                    >
                        <Chip value={value} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PotChips;
