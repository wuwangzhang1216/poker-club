
import React from 'react';
import Chip from './Chip';

interface ChipStackProps {
    amount: number;
}

const CHIP_VALUES = [1000, 500, 100, 25, 10, 5, 1];

const ChipStack: React.FC<ChipStackProps> = ({ amount }) => {
    if (amount <= 0) return null;

    let remainingAmount = amount;
    const chipsToRender: number[] = [];

    for (const value of CHIP_VALUES) {
        const count = Math.floor(remainingAmount / value);
        for (let i = 0; i < count; i++) {
            chipsToRender.push(value);
        }
        remainingAmount %= value;
    }
    if (remainingAmount > 0 && remainingAmount < 5) {
        for (let i = 0; i < remainingAmount; i++) {
            chipsToRender.push(1);
        }
    }


    return (
        <div className="relative h-16 w-12 flex flex-col-reverse items-center">
            {chipsToRender.slice(0, 10).map((value, index) => (
                <div key={index} style={{ marginBottom: `-${24}px` }} className="transform transition-transform duration-300 hover:-translate-y-1">
                    <Chip value={value} />
                </div>
            ))}
        </div>
    );
};

export default ChipStack;
