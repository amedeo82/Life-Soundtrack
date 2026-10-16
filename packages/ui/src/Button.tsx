export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'ghost';
  onClick?: () => void;
}

export function Button({ label, variant = 'primary', onClick }: ButtonProps) {
  return (
    <button type="button" data-variant={variant} onClick={onClick}>
      {label}
    </button>
  );
}
