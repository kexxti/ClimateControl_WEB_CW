import type { ReactNode } from 'react';

export const PageHeader = ({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) => (
  <header className={className}>
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    {actions}
  </header>
);

export const Panel = ({
  title,
  actions,
  children,
  className,
  headerClassName,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}) => (
  <section className={className}>
    <div className={headerClassName}>
      <h2>{title}</h2>
      {actions}
    </div>
    {children}
  </section>
);

export const MetricCard = ({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

export const StatusBadge = ({
  label,
  className,
}: {
  label: ReactNode;
  className?: string;
}) => <span className={className}>{label}</span>;

export const SegmentedControl = <T extends string>({
  value,
  options,
  getLabel,
  onChange,
  className,
  activeClassName,
}: {
  value: T;
  options: T[];
  getLabel: (value: T) => ReactNode;
  onChange: (value: T) => void;
  className?: string;
  activeClassName?: string;
}) => (
  <div className={className}>
    {options.map((item) => (
      <button
        key={item}
        className={value === item ? activeClassName : ''}
        type="button"
        onClick={() => onChange(item)}
      >
        {getLabel(item)}
      </button>
    ))}
  </div>
);
