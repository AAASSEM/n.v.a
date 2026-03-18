import React, { useState, useRef, useEffect } from 'react';

interface DropdownOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface CustomDropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function CustomDropdown({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    className = '',
}: CustomDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    return (
        <div className={`dropdown-wrapper ${className}`} ref={ref}>
            <div
                className={`dropdown-trigger ${open ? 'open' : ''}`}
                onClick={() => setOpen(o => !o)}
            >
                {selectedOption?.icon && (
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                        {selectedOption.icon}
                    </span>
                )}
                <span>{selectedOption?.label || placeholder}</span>
                <svg className="dropdown-chevron" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>

            {open && (
                <div className="dropdown-panel animate-slide-down">
                    {options.map(option => (
                        <div
                            key={option.value}
                            className={`dropdown-item ${option.value === value ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(option.value);
                                setOpen(false);
                            }}
                        >
                            {option.icon && (
                                <span style={{ display: 'flex', alignItems: 'center' }}>
                                    {option.icon}
                                </span>
                            )}
                            {option.label}
                            {option.value === value && (
                                <svg style={{ marginLeft: 'auto', width: 14, height: 14 }} viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
