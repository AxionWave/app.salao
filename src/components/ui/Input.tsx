import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export default function Input({ label, error, helperText, className = '', id, required, ...props }: InputProps) {
    const inputId = id || props.name;

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {label}
                    {required && (
                        <span style={{ color: 'var(--destructive)' }}> *</span>
                    )}
                </label>
            )}
            <input
                {...props}
                id={inputId}
                required={required}
                className={`lyra-input ${className}`}
            />
            {error && (
                <p className="mt-1 text-xs" style={{ color: 'var(--destructive)' }}>
                    {error}
                </p>
            )}
            {helperText && !error && (
                <p className="mt-1 text-xs" style={{ color: 'var(--faint)' }}>
                    {helperText}
                </p>
            )}
        </div>
    );
}
