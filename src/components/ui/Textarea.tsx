import type { TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export default function Textarea({
    label,
    error,
    helperText,
    className = '',
    id,
    required,
    rows = 3,
    ...props
}: TextareaProps) {
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
            <textarea
                {...props}
                id={inputId}
                required={required}
                rows={rows}
                className={`lyra-input resize-y min-h-[5rem] ${className}`}
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
